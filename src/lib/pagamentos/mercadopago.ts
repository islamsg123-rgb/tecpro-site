import "server-only";
import { randomUUID } from "node:crypto";
import type { Cobranca, Comprador, DadosBoleto, DadosPix, NovaCobranca, Situacao } from "./tipos";
import { ErroPagamento, produtoDaReferencia, referenciaProduto } from "./tipos";
import { configLoja } from "../config-loja";
import { listarPedidosMp, obterPedidoMp, salvarPedidoMp, type PedidoMp } from "../dados/pedidos-mp";

/**
 * Integração com o Mercado Pago (Checkout Transparente, API de pedidos "Orders": /v1/orders).
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders
 * (Contas novas do Mercado Pago só aceitam a API de pedidos; a antiga /v1/payments responde
 * "Unauthorized use of live credentials".)
 *
 * Variáveis na Vercel:
 *  - MERCADOPAGO_ACCESS_TOKEN: "Access Token" (TEST-... ou APP_USR-...; o modo de teste é detectado sozinho). Secreto.
 *  - MERCADOPAGO_PUBLIC_KEY:   "Public Key" (usada no navegador para proteger os dados do cartão). Não é secreta.
 *  - MERCADOPAGO_WEBHOOK_SECRET (opcional): "Assinatura secreta" dos webhooks, para conferir que o aviso veio do Mercado Pago.
 *
 * O cartão nunca passa pelo nosso servidor: o navegador troca os dados por um "token" com a Public Key,
 * e o servidor só envia esse token ao Mercado Pago.
 *
 * O que foi comprado e os dados do comprador ficam no nosso banco (src/lib/dados/pedidos-mp.ts), ligados ao
 * código do pedido: a API de pedidos não tem campo livre, e o external_reference só aceita letras e números.
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

/** Resposta de erro do Mercado Pago, guardada para traduzir o motivo. */
class ErroMp extends Error {
  constructor(public status: number, public json: Json) {
    super(`Mercado Pago ${status}`);
  }
}

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
    console.error("[mercadopago]", init.method ?? "GET", caminho, resp.status, JSON.stringify(json).slice(0, 1500));
    throw new ErroMp(resp.status, json);
  }
  return json as T;
}

const texto = (v: unknown) => (v == null ? "" : String(v));
const dia = (iso: unknown) => (typeof iso === "string" && iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : undefined);
const reais = (centavos: number) => (centavos / 100).toFixed(2);

/** Motivo da recusa do cartão, em português, para mostrar ao comprador. */
export function motivoRecusa(detalhe: string): string {
  const d = detalhe.replace(/^cc_rejected_/, "");
  const m: Record<string, string> = {
    bad_filled_card_number: "Confira o número do cartão.",
    bad_filled_date: "Confira a validade do cartão.",
    expired: "O cartão está vencido. Use outro cartão.",
    bad_filled_security_code: "Confira o código de segurança (CVV) do cartão.",
    bad_filled_other: "Confira os dados do cartão.",
    invalid_card_data: "Confira os dados do cartão.",
    insufficient_amount: "O cartão não tem limite suficiente. Tente outro cartão ou pague com Pix.",
    call_for_authorize: "O banco pediu para você autorizar esta compra. Ligue para o banco do cartão e tente de novo.",
    card_disabled: "O cartão está bloqueado ou inativo. Ligue para o banco ou use outro cartão.",
    duplicated_payment: "Você já fez um pagamento igual há pouco. Se precisar pagar de novo, use outro cartão ou Pix.",
    invalid_installments: "Este cartão não aceita esse número de parcelas. Escolha outro parcelamento.",
    max_attempts: "Muitas tentativas com este cartão. Use outro cartão ou pague com Pix.",
    high_risk: "O pagamento foi recusado por segurança. Tente outro cartão ou pague com Pix.",
    rejected_high_risk: "O pagamento foi recusado por segurança. Tente outro cartão ou pague com Pix.",
    blacklist: "Não foi possível usar este cartão. Tente outro cartão ou pague com Pix.",
    "3ds_mandatory": "Este cartão exige uma verificação extra que ainda não oferecemos. Tente outro cartão ou pague com Pix.",
  };
  return m[d] ?? "O pagamento não foi aprovado pelo banco do cartão. Tente outro cartão ou pague com Pix.";
}

/** Traduz um erro da API para uma mensagem que o comprador entende. */
function mensagemDoErro(e: ErroMp): string {
  const erros = (e.json.errors as { code?: string; message?: string; details?: string[] }[] | undefined) ?? [];
  const detalhes = erros.flatMap((x) => [x.code ?? "", ...(x.details ?? []), x.message ?? ""]).join(" ").toLowerCase();
  if (/cc_rejected|insufficient_amount|high_risk|rejected_by_issuer|call_for_authorize|card_disabled|max_attempts|invalid_installments|bad_filled/.test(detalhes)) {
    const codigo = detalhes.match(/(cc_rejected_\w+|insufficient_amount|high_risk|call_for_authorize|card_disabled|max_attempts|invalid_installments|bad_filled_\w+)/)?.[1] ?? "";
    return motivoRecusa(codigo);
  }
  if (detalhes.includes("invalid_transaction_amount") || detalhes.includes("installments")) {
    return "Este cartão não aceita esse parcelamento agora. Escolha \"À vista\" ou pague com Pix.";
  }
  if (detalhes.includes("zip_code") || detalhes.includes("address")) return "Confira o CEP e o número.";
  if (detalhes.includes("identification")) return "Confira o CPF.";
  if (detalhes.includes("token")) return "Confira os dados do cartão.";
  return "Não foi possível processar o pagamento. Confira os dados e tente novamente.";
}

/* ---------- Situação do pedido ---------- */

function primeiroPagamento(o: Json): Json {
  const pags = ((o.transactions as Json | undefined)?.payments as Json[] | undefined) ?? [];
  return pags[0] ?? {};
}

export function situacaoDoPedido(o: Json): Situacao {
  const status = texto(o.status);
  const detalhe = texto(o.status_detail);
  const pag = primeiroPagamento(o);
  const statusPag = texto(pag.status);
  if (status === "refunded" || statusPag === "refunded" || statusPag === "charged_back" || /refunded|reimbursed/.test(detalhe)) return "estornado";
  if ((status === "processed" && detalhe !== "waiting_capture") || detalhe === "accredited" || statusPag === "processed") return "pago";
  if (status === "canceled" || status === "expired" || detalhe === "expired" || status === "failed") return "vencido";
  return "aguardando"; // created, action_required (Pix/boleto esperando), processing
}

/** Junta o que o Mercado Pago diz (situação) com o que guardamos (produto e comprador). */
function paraCobranca(p: PedidoMp, o?: Json): Cobranca {
  const situacao = o ? situacaoDoPedido(o) : p.situacao;
  const pag = o ? primeiroPagamento(o) : {};
  const metodo = (pag.payment_method ?? {}) as Json;
  return {
    id: p.id,
    forma: p.forma,
    situacao,
    valorCentavos: p.valorCentavos,
    produto: produtoDaReferencia(p.referencia),
    vencimento: dia(pag.date_of_expiration) ?? p.vencimento,
    linkFatura: texto(metodo.ticket_url) || undefined,
    descricao: p.descricao,
    criadoEm: p.criadoEm,
    cliente: [p.comprador.nome, p.comprador.email].filter(Boolean).join(" · ") || undefined,
    clienteEmail: p.comprador.email || undefined,
    clienteTelefone: p.comprador.telefone || undefined,
    pagoEm: p.pagoEm ?? (situacao === "pago" ? dia(o?.last_updated_date) ?? dia(new Date().toISOString()) : undefined),
    comprador: p.comprador,
    detalheSituacao: o ? texto(o.status_detail) || undefined : undefined,
  };
}

/** Guarda a nova situação no banco quando ela muda (para o painel abrir rápido). */
async function atualizarSituacao(p: PedidoMp, c: Cobranca): Promise<void> {
  if (p.situacao === c.situacao) return;
  await salvarPedidoMp({ ...p, situacao: c.situacao, pagoEm: c.situacao === "pago" ? c.pagoEm : p.pagoEm }).catch((e) =>
    console.error("[mercadopago] não consegui atualizar o pedido", p.id, e),
  );
}

/* ---------- Endereço pelo CEP (o boleto exige endereço completo) ---------- */

/** Usa o ViaCEP e, se falhar, a BrasilAPI (gratuitos). */
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

/* ---------- Referência de reserva no próprio pedido ---------- */

/**
 * O pedido também leva, no external_reference (só letras, números e "_"), o curso e o tipo de compra.
 * Serve de reserva se o registro no nosso banco faltar: o e-mail vem do pagador do pedido.
 *   curso:        c_<curso>_<aleatório>
 *   certificado:  k_<quantidade>_<curso>_<aleatório>
 */
function referenciaExterna(n: NovaCobranca): string {
  const acaso = randomUUID().replaceAll("-", "").slice(0, 10);
  const curso = n.produto.cursoId.replace(/[^A-Za-z0-9-]/g, "").slice(0, 30);
  return n.produto.tipo === "curso" ? `c_${curso}_${acaso}` : `k_${n.produto.quantidade ?? 1}_${curso}_${acaso}`;
}

/** Monta o registro a partir do próprio pedido, quando ele não está no nosso banco. */
function pedidoDaReserva(o: Json): PedidoMp | null {
  const ref = texto(o.external_reference);
  const payer = (o.payer ?? {}) as Json;
  const email = texto(payer.email).toLowerCase();
  if (!email) return null;
  let referencia = "";
  const c = ref.match(/^c_([A-Za-z0-9-]+)_[a-f0-9]+$/);
  const k = ref.match(/^k_(\d+)_([A-Za-z0-9-]+)_[a-f0-9]+$/);
  if (c) referencia = referenciaProduto({ tipo: "curso", cursoId: c[1] });
  else if (k) referencia = referenciaProduto({ tipo: "certificado", cursoId: k[2], email, quantidade: Number(k[1]) });
  else return null;
  const ident = (payer.identification ?? {}) as Json;
  const pag = primeiroPagamento(o);
  const tipo = texto(((pag.payment_method ?? {}) as Json).type);
  return {
    id: texto(o.id),
    referencia,
    comprador: {
      nome: [payer.first_name, payer.last_name].filter(Boolean).join(" ") || email,
      email,
      cpf: texto(ident.number),
      telefone: "",
    },
    forma: tipo === "credit_card" || tipo === "debit_card" ? "CREDIT_CARD" : tipo === "ticket" ? "BOLETO" : "PIX",
    valorCentavos: Math.round(Number(o.total_amount ?? pag.amount ?? 0) * 100),
    descricao: texto(o.description),
    criadoEm: texto(o.created_date) || new Date().toISOString(),
    vencimento: dia(pag.date_of_expiration) ?? dia(o.created_date) ?? "",
    situacao: "aguardando",
  };
}

/* ---------- Criar o pedido ---------- */

export async function criarCobrancaMp(n: NovaCobranca): Promise<Cobranca> {
  const [primeiro, ...resto] = n.comprador.nome.trim().split(/\s+/);
  const sobrenome = resto.join(" ") || primeiro;
  const valor = reais(n.valorCentavos);
  const pagamento: Json = { amount: valor };
  const payer: Json = {
    email: n.comprador.email,
    first_name: primeiro,
    last_name: sobrenome,
    entity_type: "individual",
    identification: { type: "CPF", number: n.comprador.cpf },
  };
  if (n.comprador.telefone.length >= 10) payer.phone = { area_code: n.comprador.telefone.slice(0, 2), number: n.comprador.telefone.slice(2) };

  if (n.forma === "PIX") {
    pagamento.payment_method = { id: "pix", type: "bank_transfer" };
    pagamento.expiration_time = "P1D";
  } else if (n.forma === "BOLETO") {
    if (!n.endereco) throw new ErroPagamento("Informe o CEP e o número para gerar o boleto.");
    pagamento.payment_method = { id: "boleto", type: "ticket" };
    pagamento.expiration_time = `P${configLoja.diasVencimentoBoleto}D`;
    payer.address = {
      zip_code: n.endereco.cep,
      street_name: n.endereco.rua || "Não informado",
      street_number: n.endereco.numero || "S/N",
      neighborhood: n.endereco.bairro || "Centro",
      city: n.endereco.cidade,
      state: n.endereco.uf,
    };
  } else {
    if (!n.cartaoMp?.token || !n.cartaoMp.bandeira) throw new ErroPagamento("Confira os dados do cartão.");
    pagamento.payment_method = {
      id: n.cartaoMp.bandeira,
      type: "credit_card",
      token: n.cartaoMp.token,
      installments: n.parcelas ?? 1,
      statement_descriptor: "TECPRO",
    };
  }

  const corpo: Json = {
    type: "online",
    processing_mode: "automatic",
    total_amount: valor,
    external_reference: referenciaExterna(n),
    description: n.descricao.slice(0, 150),
    transactions: { payments: [pagamento] },
    payer,
    items: [{ title: n.descricao.slice(0, 150), unit_price: valor, quantity: 1, external_code: n.produto.cursoId, category_id: "learnings" }],
  };

  let o: Json;
  try {
    // A chave única impede cobrar duas vezes se o pedido for reenviado por engano.
    o = await chamar<Json>("/v1/orders", { method: "POST", body: corpo, idempotencia: randomUUID() });
  } catch (e) {
    if (e instanceof ErroMp) throw new ErroPagamento(mensagemDoErro(e));
    throw e;
  }

  const situacao = situacaoDoPedido(o);
  if (n.forma === "CREDIT_CARD" && (texto(o.status) === "failed" || situacao === "vencido")) {
    throw new ErroPagamento(motivoRecusa(texto(primeiroPagamento(o).status_detail) || texto(o.status_detail)));
  }

  const pedido: PedidoMp = {
    id: texto(o.id),
    referencia: referenciaProduto(n.produto),
    comprador: n.comprador,
    forma: n.forma,
    valorCentavos: n.valorCentavos,
    descricao: n.descricao,
    criadoEm: new Date().toISOString(),
    vencimento: dia(primeiroPagamento(o).date_of_expiration) ?? dia(new Date(Date.now() + 86_400_000).toISOString())!,
    situacao,
    pagoEm: situacao === "pago" ? dia(new Date().toISOString()) : undefined,
    parcelas: n.forma === "CREDIT_CARD" ? n.parcelas ?? 1 : undefined,
  };
  try {
    await salvarPedidoMp(pedido);
  } catch (e) {
    // Sem isso não saberíamos o que liberar: registra bem alto (o pedido existe no Mercado Pago).
    console.error("[mercadopago] PEDIDO CRIADO MAS NÃO GUARDADO", pedido.id, pedido.referencia, pedido.comprador.email, e);
  }
  return paraCobranca(pedido, o);
}

/* ---------- Consultas ---------- */

export async function pedidoMp(id: string): Promise<Json> {
  return chamar<Json>(`/v1/orders/${encodeURIComponent(id)}`);
}

export async function consultarCobrancaMp(id: string): Promise<Cobranca | null> {
  try {
    const [guardado, o] = await Promise.all([obterPedidoMp(id).catch(() => null), pedidoMp(id)]);
    const p = guardado ?? pedidoDaReserva(o);
    if (!p) {
      console.error("[mercadopago] pedido sem registro no banco e sem referência de reserva", id);
      return null;
    }
    if (!guardado) {
      console.warn("[mercadopago] pedido sem registro no banco; usando a referência do próprio pedido", id);
      await salvarPedidoMp(p).catch(() => {});
    }
    const c = paraCobranca(p, o);
    await atualizarSituacao(p, c);
    return c;
  } catch (e) {
    console.error("[mercadopago] consulta", id, e instanceof Error ? e.message : e);
    return null;
  }
}

/* Lista recente, guardada por 1 minuto para o painel abrir rápido. */
const gLista = globalThis as unknown as { __cobrancasMp?: { quando: number; limite: number; lista: Cobranca[] } };

/** Pedidos mais recentes. Os que ainda estão aguardando (dos últimos 35 dias) são conferidos no Mercado Pago. */
export async function listarCobrancasMp(limite = 50): Promise<Cobranca[]> {
  const guardada = gLista.__cobrancasMp;
  if (guardada && guardada.limite >= limite && Date.now() - guardada.quando < 60_000) return guardada.lista.slice(0, limite);
  const pedidos = await listarPedidosMp(limite);
  const limiteData = new Date(Date.now() - 35 * 86_400_000).toISOString();
  const lista: Cobranca[] = [];
  for (let i = 0; i < pedidos.length; i += 10) {
    lista.push(
      ...(await Promise.all(
        pedidos.slice(i, i + 10).map(async (p) => {
          if (p.situacao !== "aguardando" || p.criadoEm < limiteData) return paraCobranca(p);
          const o = await pedidoMp(p.id).catch(() => undefined);
          const c = paraCobranca(p, o);
          await atualizarSituacao(p, c);
          return c;
        }),
      )),
    );
  }
  gLista.__cobrancasMp = { quando: Date.now(), limite, lista };
  return lista;
}

/** Pedidos de um e-mail (comprador, ou aluno do certificado). */
export async function cobrancasDoEmailMp(email: string): Promise<Cobranca[]> {
  return (await listarCobrancasMp(300)).filter(
    (c) => c.clienteEmail === email || (c.produto?.tipo === "certificado" && c.produto.email === email),
  );
}

export async function clientePorEmailMp(email: string): Promise<Comprador | null> {
  return (await cobrancasDoEmailMp(email)).find((x) => x.comprador?.cpf)?.comprador ?? null;
}

export async function pixMp(id: string): Promise<DadosPix> {
  const m = (primeiroPagamento(await pedidoMp(id)).payment_method ?? {}) as Json;
  if (!m.qr_code) throw new Error("Pedido sem QR Code Pix");
  return { imagemBase64: texto(m.qr_code_base64), copiaECola: texto(m.qr_code) };
}

export async function boletoMp(id: string): Promise<DadosBoleto> {
  const m = (primeiroPagamento(await pedidoMp(id)).payment_method ?? {}) as Json;
  const linha = texto(m.digitable_line) || texto(m.barcode_content);
  const link = texto(m.ticket_url);
  if (!linha || !link) throw new Error("Pedido sem dados do boleto");
  return { linhaDigitavel: linha, linkPdf: link };
}

/** Códigos de pedido do Mercado Pago começam com "ORD" (os do Asaas, com "pay_"; os do simulador, com "sim_"). */
export const eIdMercadoPago = (id: string) => /^ORD[A-Z0-9]+$/i.test(id);
