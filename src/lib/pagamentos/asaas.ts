import "server-only";
import type { Cobranca, Comprador, DadosBoleto, DadosPix, NovaCobranca, Situacao } from "./tipos";
import { ErroPagamento, produtoDaReferencia, referenciaProduto } from "./tipos";
import { configLoja } from "../config-loja";

/**
 * Integração com o Asaas (API v3). Docs: https://docs.asaas.com
 * Chave em ASAAS_API_KEY. ASAAS_AMBIENTE=producao usa a conta real; qualquer outro valor usa o sandbox (testes).
 */

const CHAVE = process.env.ASAAS_API_KEY;
const URL_BASE =
  process.env.ASAAS_AMBIENTE === "producao" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

export const asaasConfigurado = Boolean(CHAVE);

type Json = Record<string, unknown>;

async function chamar<T = Json>(caminho: string, init: { method?: string; body?: Json } = {}): Promise<T> {
  const resp = await fetch(`${URL_BASE}${caminho}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", "User-Agent": "tecpro-site", access_token: CHAVE! },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await resp.json().catch(() => ({}))) as Json;
  if (!resp.ok) {
    const erros = (json.errors as { description?: string }[] | undefined)?.map((e) => e.description).filter(Boolean);
    console.error("[asaas]", caminho, resp.status, erros);
    throw new ErroPagamento(erros?.join(" ") || "Não foi possível processar o pagamento. Tente novamente.");
  }
  return json as T;
}

/** Data AAAA-MM-DD no fuso de Brasília, daqui a N dias. */
export function hojeMais(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function traduzirStatus(status: string): Situacao {
  switch (status) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "pago";
    case "OVERDUE":
      return "vencido";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "REFUND_IN_PROGRESS":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
      return "estornado";
    default:
      return "aguardando";
  }
}


export function paraCobranca(p: Json): Cobranca {
  return {
    id: String(p.id),
    forma: p.billingType as Cobranca["forma"],
    situacao: traduzirStatus(String(p.status)),
    valorCentavos: Math.round(Number(p.value) * 100),
    produto: produtoDaReferencia(p.externalReference),
    vencimento: String(p.dueDate),
    linkFatura: (p.bankSlipUrl as string) || (p.invoiceUrl as string) || undefined,
    descricao: (p.description as string) || undefined,
    criadoEm: (p.dateCreated as string) || undefined,
  };
}

/** Procura o cliente pelo CPF; se não existir, cria. */
async function obterCliente(c: Comprador): Promise<string> {
  const busca = await chamar<{ data?: { id: string }[] }>(`/customers?cpfCnpj=${c.cpf}`);
  if (busca.data?.[0]) return busca.data[0].id;
  const novo = await chamar<{ id: string }>("/customers", {
    method: "POST",
    body: { name: c.nome, email: c.email, cpfCnpj: c.cpf, mobilePhone: c.telefone },
  });
  return novo.id;
}

export async function criarCobrancaAsaas(n: NovaCobranca): Promise<Cobranca> {
  const customer = await obterCliente(n.comprador);
  const valor = n.valorCentavos / 100;
  const corpo: Json = {
    customer,
    billingType: n.forma,
    dueDate: hojeMais(n.forma === "BOLETO" ? configLoja.diasVencimentoBoleto : 1),
    description: n.descricao,
    externalReference: referenciaProduto(n.produto),
  };

  if (n.forma === "CREDIT_CARD") {
    if (!n.cartao) throw new ErroPagamento("Dados do cartão ausentes.");
    const parcelas = n.parcelas ?? 1;
    if (parcelas > 1) {
      corpo.installmentCount = parcelas;
      corpo.totalValue = valor;
    } else {
      corpo.value = valor;
    }
    corpo.creditCard = {
      holderName: n.cartao.nomeNoCartao,
      number: n.cartao.numero,
      expiryMonth: n.cartao.mesValidade.padStart(2, "0"),
      expiryYear: n.cartao.anoValidade.length === 2 ? `20${n.cartao.anoValidade}` : n.cartao.anoValidade,
      ccv: n.cartao.cvv,
    };
    corpo.creditCardHolderInfo = {
      name: n.comprador.nome,
      email: n.comprador.email,
      cpfCnpj: n.comprador.cpf,
      postalCode: n.cartao.cep,
      addressNumber: n.cartao.numeroEndereco,
      mobilePhone: n.comprador.telefone,
    };
    corpo.remoteIp = n.ipComprador ?? "0.0.0.0";
  } else {
    corpo.value = valor;
  }

  return paraCobranca(await chamar("/payments", { method: "POST", body: corpo }));
}

export async function consultarCobrancaAsaas(id: string): Promise<Cobranca | null> {
  try {
    return paraCobranca(await chamar(`/payments/${encodeURIComponent(id)}`));
  } catch {
    return null;
  }
}

/** Últimas cobranças da conta (mais recentes primeiro), para o painel. */
export async function listarCobrancasAsaas(limite = 50): Promise<Cobranca[]> {
  const r = await chamar<{ data?: Json[] }>(`/payments?limit=${limite}&offset=0`);
  return (r.data ?? []).map(paraCobranca);
}

export async function pixAsaas(id: string): Promise<DadosPix> {
  const r = await chamar<{ encodedImage: string; payload: string; expirationDate?: string }>(
    `/payments/${encodeURIComponent(id)}/pixQrCode`,
  );
  return { imagemBase64: r.encodedImage, copiaECola: r.payload, expiraEm: r.expirationDate };
}

export async function boletoAsaas(id: string, linkPdf: string): Promise<DadosBoleto> {
  const r = await chamar<{ identificationField: string }>(`/payments/${encodeURIComponent(id)}/identificationField`);
  return { linhaDigitavel: r.identificationField, linkPdf };
}

export async function compradorDoClienteAsaas(clienteId: string): Promise<Comprador> {
  const c = await chamar<Json>(`/customers/${encodeURIComponent(clienteId)}`);
  return {
    nome: String(c.name ?? ""),
    email: String(c.email ?? ""),
    cpf: String(c.cpfCnpj ?? ""),
    telefone: String(c.mobilePhone ?? c.phone ?? ""),
  };
}
