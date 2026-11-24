import "server-only";
import { randomUUID } from "node:crypto";
import type { Cobranca, Comprador, DadosBoleto, DadosPix, FormaPagamento, NovaCobranca, Situacao } from "./tipos";
import { ErroPagamento, produtoDaReferencia, referenciaProduto } from "./tipos";
import { configLoja } from "../config-loja";
import { SITE_OFICIAL } from "../site";

/**
 * Integração com o Mercado Pago (Checkout Transparente, API /v1/payments). Docs: https://www.mercadopago.com.br/developers
 *
 * Variáveis na Vercel:
 *  - MERCADOPAGO_ACCESS_TOKEN: "Access Token" (TEST-... ou APP_USR-...; o modo de teste é detectado sozinho). Secreto.
 *  - MERCADOPAGO_PUBLIC_KEY:   "Public Key" (usada no navegador para proteger os dados do cartão). Não é secreta.
 *  - MERCADOPAGO_WEBHOOK_SECRET (opcional): "Assinatura secreta" dos webhooks, para conferir que o aviso veio do Mercado Pago.
 *
 * O cartão nunca passa pelo nosso servidor: o navegador troca os dados por um "token" com a Public Key,
 * e o servidor só envia esse token ao Mercado Pago.
 *
 * O que foi comprado e os dados do comprador ficam no "metadata" do pagamento (o Mercado Pago só aceita
 * letras, números, "-" e "_" no external_reference, e a nossa referência tem ":" e "@").
 */

const TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
// MERCADOPAGO_API_URL só serve para testes automáticos (servidor falso); na Vercel, não preencher.
const URL_BASE = process.env.MERCADOPAGO_API_URL || "https://api.mercadopago.com";

export const mpConfigurado = Boolean(TOKEN);
export const chavePublicaMp = process.env.MERCADOPAGO_PUBLIC_KEY ?? "";
/**
 * Credenciais de teste: as antigas começam com "TEST-"; as novas (APP_USR-...) são de um "usuário de teste",
 * que o Mercado Pago marca com a etiqueta "test_user". MERCADOPAGO_MODO=teste/producao força o modo.
 */
const gTeste = globalThis as unknown as { __mpEmTeste?: Promise<boolean> };
export function mpEmTeste(): Promise<boolean> {
  if (!TOKEN) return Promise.resolve(false);
  const modo = process.env.MERCADOPAGO_MODO?.toLowerCase();
  if (modo === "teste") return Promise.resolve(true);
  if (modo === "producao" || modo === "produção") return Promise.resolve(false);
  if (TOKEN.startsWith("TEST-")) return Promise.resolve(true);
  gTeste.__mpEmTeste ??= chamar<{ tags?: string[]; nickname?: string; email?: string }>("/users/me")
    .then((u) => Boolean(u.tags?.includes("test_user") || /^TESTUSER|^TEST_USER/i.test(u.nickname ?? "") || /@testuser\.com$/i.test(u.email ?? "")))
    .catch(() => {
      gTeste.__mpEmTeste = undefined; // tenta de novo na próxima vez
      return false;
    });
  return gTeste.__mpEmTeste;
}

type Json = Record<string, unknown>;

async function chamar<T = Json>(caminho: string, init: { method?: string; body?: Json; idempotencia?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` };
  if (init.idempotencia) headers["X-Idempotency-Key"] = init.idempotencia;
  const resp = await fetch(`${URL_BASE}${caminho}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await resp.json().catch(() => ({}))) as Json;
  if (!resp.ok) {
    const causas = (json.cause as { description?: string; code?: unknown }[] | undefined)?.map((c) => `${c.code ?? ""} ${c.description ?? ""}`.trim());
    console.error("[mercadopago]", caminho, resp.status, json.message, causas);
    throw new ErroPagamento(mensagemErroApi(json));
  }
  return json as T;
}

/** Erros de dados (antes de ir ao banco) em português. */
function mensagemErroApi(json: Json): string {
  const codigos = ((json.cause as { code?: unknown }[] | undefined) ?? []).map((c) => String(c.code));
  if (codigos.some((c) => ["205", "E205", "325", "326", "E301"].includes(c))) return "Confira o número e a validade do cartão.";
  if (codigos.some((c) => ["E203", "224"].includes(c))) return "Confira o código de segurança (CVV) do cartão.";
  if (codigos.some((c) => ["2067", "324", "214"].includes(c))) return "Confira o CPF.";
  if (codigos.some((c) => ["4037"].includes(c))) return "Valor inválido para este pagamento.";
  if (String(json.message ?? "").toLowerCase().includes("zip_code")) return "Confira o CEP.";
  return "Não foi possível processar o pagamento. Confira os dados e tente novamente.";
}

/** Motivo da recusa do cartão, em português, para mostrar ao comprador. */
export function motivoRecusa(detalhe: string): string {
  const m: Record<string, string> = {
    cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
    cc_rejected_bad_filled_date: "Confira a validade do cartão.",
    cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV) do cartão.",
    cc_rejected_bad_filled_other: "Confira os dados do cartão.",
    cc_rejected_insufficient_amount: "O cartão não tem limite suficiente. Tente outro cartão ou pague com Pix.",
    cc_rejected_call_for_authorize: "O banco pediu para você autorizar esta compra. Ligue para o banco do cartão e tente de novo.",
    cc_rejected_card_disabled: "O cartão está bloqueado ou inativo. Ligue para o banco ou use outro cartão.",
    cc_rejected_duplicated_payment: "Você já fez um pagamento igual há pouco. Se precisar pagar de novo, use outro cartão ou Pix.",
    cc_rejected_invalid_installments: "Este cartão não aceita esse número de parcelas. Escolha outro parcelamento.",
    cc_rejected_max_attempts: "Muitas tentativas com este cartão. Use outro cartão ou pague com Pix.",
    cc_rejected_high_risk: "O pagamento foi recusado por segurança. Tente outro cartão ou pague com Pix.",
    rejected_high_risk: "O pagamento foi recusado por segurança. Tente outro cartão ou pague com Pix.",
    cc_rejected_blacklist: "Não foi possível usar este cartão. Tente outro cartão ou pague com Pix.",
    cc_rejected_3ds_mandatory: "Este cartão exige uma verificação extra que ainda não oferecemos. Tente outro cartão ou pague com Pix.",
  };
  return m[detalhe] ?? "O pagamento não foi aprovado pelo banco do cartão. Tente outro cartão ou pague com Pix.";
}

export function traduzirStatusMp(status: string): Situacao {
  switch (status) {
    case "approved":
    case "authorized":
      return "pago";
    case "cancelled":
    case "rejected":
      return "vencido";
    case "refunded":
    case "charged_back":
      return "estornado";
    default: // pending, in_process, in_mediation
      return "aguardando";
  }
}

function formaMp(p: Json): FormaPagamento {
  const tipo = String(p.payment_type_id ?? "");
  if (tipo === "credit_card" || tipo === "debit_card") return "CREDIT_CARD";
  if (tipo === "ticket" || String(p.payment_method_id).startsWith("bol")) return "BOLETO";
  return "PIX";
}

const dia = (iso: unknown) => (typeof iso === "string" && iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : undefined);
const texto = (v: unknown) => (v == null ? "" : String(v));

/** Dados do comprador, guardados no metadata quando o pagamento foi criado. */
export function compradorDoPagamento(p: Json): Comprador {
  const md = (p.metadata ?? {}) as Json;
  const payer = (p.payer ?? {}) as Json;
  const ident = (payer.identification ?? {}) as Json;
  const nomePayer = [payer.first_name, payer.last_name].filter(Boolean).join(" ");
  return {
    nome: texto(md.nome) || nomePayer,
    email: (texto(md.email) || texto(payer.email)).toLowerCase(),
    cpf: texto(md.cpf) || texto(ident.number),
    telefone: texto(md.telefone),
  };
}

export function paraCobrancaMp(p: Json): Cobranca {
  const md = (p.metadata ?? {}) as Json;
  const det = (p.transaction_details ?? {}) as Json;
  const comprador = compradorDoPagamento(p);
  const valor = Number(p.transaction_amount ?? 0);
  const liquido = det.net_received_amount != null ? Number(det.net_received_amount) : null;
  return {
    id: String(p.id),
    forma: formaMp(p),
    situacao: traduzirStatusMp(String(p.status)),
    valorCentavos: Math.round(valor * 100),
    produto: produtoDaReferencia(md.referencia),
    vencimento: dia(p.date_of_expiration) ?? dia(p.date_created) ?? "",
    linkFatura: texto(det.external_resource_url) || texto((((p.point_of_interaction ?? {}) as Json).transaction_data as Json | undefined)?.ticket_url) || undefined,
    descricao: texto(p.description) || undefined,
    criadoEm: texto(p.date_created) || undefined,
    cliente: [comprador.nome, comprador.email].filter(Boolean).join(" · ") || undefined,
    clienteEmail: comprador.email || undefined,
    clienteTelefone: comprador.telefone || undefined,
    pagoEm: dia(p.date_approved),
    // Só faz sentido depois de pago (antes, o Mercado Pago devolve 0).
    valorLiquidoCentavos: liquido != null && liquido > 0 ? Math.round(liquido * 100) : undefined,
    comprador,
    detalheSituacao: texto(p.status_detail) || undefined,
  };
}

/** Endereço do aviso automático. Em teste local (http), o Mercado Pago não aceita: fica sem. */
function urlDoAviso(): string | undefined {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || SITE_OFICIAL).replace(/\/$/, "");
  return base.startsWith("https://") ? `${base}/api/webhooks/mercadopago` : undefined;
}

/** Endereço pelo CEP (o boleto do Mercado Pago exige endereço completo). Usa o ViaCEP e, se falhar, a BrasilAPI (gratuitos). */
export async function enderecoPorCep(cep: string): Promise<{ rua: string; bairro: string; cidade: string; uf: string } | null> {
  const buscar = async (url: string) => {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const j = (await r.json()) as Json;
    if (!r.ok || j.erro) return null;
    const cidade = texto(j.localidade ?? j.city);
    const uf = texto(j.uf ?? j.state);
    return cidade && uf.length === 2 ? { rua: texto(j.logradouro ?? j.street), bairro: texto(j.bairro ?? j.neighborhood), cidade, uf } : null;
  };
  // CEP_API_URL só serve para testes automáticos; na Vercel, não preencher.
  const fontes = process.env.CEP_API_URL
    ? [`${process.env.CEP_API_URL}/ws/${cep}/json/`]
    : [`https://viacep.com.br/ws/${cep}/json/`, `https://brasilapi.com.br/api/cep/v1/${cep}`];
  for (const url of fontes) {
    const end = await buscar(url).catch(() => null);
    if (end) return end;
  }
  return null;
}

/** Data/hora no formato que o Mercado Pago pede, no fim do dia em Brasília, daqui a N dias. */
function fimDoDia(dias: number): string {
  const d = new Date(Date.now() + dias * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return `${d}T23:59:59.000-03:00`;
}

export async function criarCobrancaMp(n: NovaCobranca): Promise<Cobranca> {
  const [primeiro, ...resto] = n.comprador.nome.trim().split(/\s+/);
  const corpo: Json = {
    transaction_amount: n.valorCentavos / 100,
    description: n.descricao.slice(0, 250),
    external_reference: `tecpro_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
    statement_descriptor: "TECPRO",
    metadata: {
      referencia: referenciaProduto(n.produto),
      nome: n.comprador.nome,
      email: n.comprador.email,
      cpf: n.comprador.cpf,
      telefone: n.comprador.telefone,
    },
    payer: {
      email: n.comprador.email,
      first_name: primeiro,
      last_name: resto.join(" ") || primeiro,
      identification: { type: "CPF", number: n.comprador.cpf },
    },
    additional_info: {
      items: [{ id: n.produto.cursoId, title: n.descricao.slice(0, 250), quantity: 1, unit_price: n.valorCentavos / 100, category_id: "learnings" }],
      payer: {
        first_name: primeiro,
        last_name: resto.join(" ") || primeiro,
        phone: { area_code: n.comprador.telefone.slice(0, 2), number: n.comprador.telefone.slice(2) },
      },
    },
  };
  const aviso = urlDoAviso();
  if (aviso) corpo.notification_url = aviso;

  if (n.forma === "PIX") {
    corpo.payment_method_id = "pix";
    corpo.date_of_expiration = new Date(Date.now() + 24 * 3_600_000).toISOString().replace("Z", "+00:00");
  } else if (n.forma === "BOLETO") {
    if (!n.endereco) throw new ErroPagamento("Informe o CEP e o número para gerar o boleto.");
    corpo.payment_method_id = "bolbradesco";
    corpo.date_of_expiration = fimDoDia(configLoja.diasVencimentoBoleto);
    (corpo.payer as Json).address = {
      zip_code: n.endereco.cep,
      street_name: n.endereco.rua || "Não informado",
      street_number: n.endereco.numero || "S/N",
      neighborhood: n.endereco.bairro || "Centro",
      city: n.endereco.cidade,
      federal_unit: n.endereco.uf,
    };
  } else {
    if (!n.cartaoMp?.token || !n.cartaoMp.bandeira) throw new ErroPagamento("Confira os dados do cartão.");
    corpo.token = n.cartaoMp.token;
    corpo.installments = n.parcelas ?? 1;
    corpo.payment_method_id = n.cartaoMp.bandeira;
    if (n.cartaoMp.emissor) corpo.issuer_id = n.cartaoMp.emissor;
  }

  // A mesma chave impede cobrar duas vezes se o pedido for reenviado por engano.
  const p = await chamar<Json>("/v1/payments", { method: "POST", body: corpo, idempotencia: randomUUID() });
  if (p.status === "rejected") throw new ErroPagamento(motivoRecusa(texto(p.status_detail)));
  return paraCobrancaMp(p);
}

/** Pagamento cru (para o aviso automático e a rede de segurança). */
export async function pagamentoMp(id: string): Promise<Json> {
  return chamar<Json>(`/v1/payments/${encodeURIComponent(id)}`);
}

export async function consultarCobrancaMp(id: string): Promise<Cobranca | null> {
  try {
    return paraCobrancaMp(await pagamentoMp(id));
  } catch {
    return null;
  }
}

/* Lista recente, guardada por 1 minuto para o painel abrir rápido. */
const gLista = globalThis as unknown as { __cobrancasMp?: { quando: number; limite: number; lista: Cobranca[] } };

/** Pagamentos mais recentes (cartões recusados ficam de fora: não são venda nem dívida). */
export async function listarCobrancasMp(limite = 50): Promise<Cobranca[]> {
  const guardada = gLista.__cobrancasMp;
  if (guardada && guardada.limite >= limite && Date.now() - guardada.quando < 60_000) return guardada.lista.slice(0, limite);
  const todas: Json[] = [];
  // O Mercado Pago devolve no máximo 100 por página (e só os dos últimos 12 meses).
  for (let offset = 0; todas.length < limite && offset < 1000; offset += 100) {
    const r = await chamar<{ results?: Json[]; paging?: { total?: number } }>(
      `/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=NOW-365DAYS&end_date=NOW&limit=100&offset=${offset}`,
    );
    const pagina = r.results ?? [];
    todas.push(...pagina.filter((p) => p.status !== "rejected"));
    if (pagina.length < 100) break;
  }
  const lista = todas.slice(0, limite).map(paraCobrancaMp);
  gLista.__cobrancasMp = { quando: Date.now(), limite, lista };
  return lista;
}

/** Pagamentos de um e-mail. */
export async function cobrancasDoEmailMp(email: string): Promise<Cobranca[]> {
  const r = await chamar<{ results?: Json[] }>(
    `/v1/payments/search?sort=date_created&criteria=desc&limit=100&payer.email=${encodeURIComponent(email)}`,
  ).catch(() => ({ results: [] as Json[] }));
  const diretos = (r.results ?? []).map(paraCobrancaMp);
  // O filtro por e-mail nem sempre pega tudo (ex.: e-mail do certificado diferente do pagador): completa com os recentes.
  const recentes = (await listarCobrancasMp(300)).filter((c) => c.clienteEmail === email || (c.produto?.tipo === "certificado" && c.produto.email === email));
  const porId = new Map<string, Cobranca>();
  for (const c of [...diretos, ...recentes]) if (c.situacao !== "vencido" || c.forma !== "CREDIT_CARD") porId.set(c.id, c);
  return Array.from(porId.values()).sort((a, b) => String(b.criadoEm ?? "").localeCompare(String(a.criadoEm ?? "")));
}

export async function clientePorEmailMp(email: string): Promise<Comprador | null> {
  const c = (await cobrancasDoEmailMp(email)).find((x) => x.comprador?.cpf);
  return c?.comprador ?? null;
}

export function pixDoPagamento(p: Json): DadosPix {
  const t = (((p.point_of_interaction ?? {}) as Json).transaction_data ?? {}) as Json;
  if (!t.qr_code) throw new Error("Pagamento sem QR Code Pix");
  return { imagemBase64: texto(t.qr_code_base64), copiaECola: texto(t.qr_code), expiraEm: texto(p.date_of_expiration) || undefined };
}

export async function pixMp(id: string): Promise<DadosPix> {
  return pixDoPagamento(await pagamentoMp(id));
}

export async function boletoMp(id: string): Promise<DadosBoleto> {
  const p = await pagamentoMp(id);
  const det = (p.transaction_details ?? {}) as Json;
  const barcode = (p.barcode ?? {}) as Json;
  const linha = texto(det.digitable_line) || texto(barcode.content);
  const link = texto(det.external_resource_url);
  if (!linha || !link) throw new Error("Pagamento sem dados do boleto");
  return { linhaDigitavel: linha, linkPdf: link };
}

/** Ids do Mercado Pago são só números (os do Asaas começam com "pay_"; os do simulador, com "sim_"). */
export const eIdMercadoPago = (id: string) => /^\d+$/.test(id);
