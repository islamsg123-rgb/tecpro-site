import "server-only";
import { bancoEmDemonstracao, db } from "./index";
import type { Produto } from "../pagamentos/tipos";

/**
 * Aviso de nova venda no painel (o "plim").
 * Cada pagamento confirmado vira um registro curto; o painel aberto pergunta a cada poucos segundos
 * se chegou algum novo. Fica na tabela configuracoes_loja (chave "venda:<código da cobrança>"),
 * sem precisar de SQL novo. A mesma cobrança nunca gera dois avisos (o Mercado Pago repete avisos).
 */

export interface AvisoVenda {
  cobrancaId: string;
  valorCentavos: number | null;
  nome: string;
  /** O que foi vendido, ex.: "Excel Avançado" ou "Certificado (pacote com 3)" */
  item: string;
  em: string; // data/hora ISO
}

/** O que a liberação sabe da cobrança (nem todo caminho tem tudo). */
export interface DadosVenda {
  valorCentavos?: number;
  /** Data do pagamento (AAAA-MM-DD ou ISO) */
  pagoEm?: string;
}

const PREFIXO = "venda:";
const g = globalThis as unknown as { __avisosVendaDemo?: AvisoVenda[] };
const demo = (g.__avisosVendaDemo ??= []);

/** Registra a venda. Nunca derruba a liberação do curso: se der erro, só registra no log. */
export async function registrarAvisoVenda(
  cobrancaId: string, nome: string, produto: Produto, venda: DadosVenda = {}, nomeCurso?: string,
): Promise<void> {
  // Matrícula grátis ou feita pelo painel não é venda.
  if (/^(gratis|painel)-/.test(cobrancaId)) return;
  // Venda antiga liberada de novo (ex.: botão "Matricular de novo"): não é novidade.
  if (venda.pagoEm && Date.now() - new Date(venda.pagoEm.slice(0, 10) + "T12:00:00Z").getTime() > 2 * 86400_000) return;
  const valorCentavos = venda.valorCentavos;
  const item =
    produto.tipo === "certificado"
      ? (produto.quantidade ?? 1) > 1 ? `Certificado (pacote com ${produto.quantidade})` : `Certificado${nomeCurso ? ` de ${nomeCurso}` : ""}`
      : nomeCurso ?? `Curso ${produto.cursoId}`;
  const aviso: AvisoVenda = { cobrancaId, valorCentavos: valorCentavos ?? null, nome: primeiroNome(nome), item, em: new Date().toISOString() };
  try {
    if (bancoEmDemonstracao) {
      if (!demo.some((a) => a.cobrancaId === cobrancaId)) demo.push(aviso);
      return;
    }
    const { error } = await db()
      .from("configuracoes_loja")
      .upsert({ chave: PREFIXO + cobrancaId, valor: aviso, atualizado_em: aviso.em }, { onConflict: "chave", ignoreDuplicates: true });
    if (error) throw error;
  } catch (e) {
    console.error(`[aviso-venda] não consegui registrar a venda ${cobrancaId}`, e);
  }
}

/** Vendas registradas depois de `desde` (data/hora ISO), mais antigas primeiro. */
export async function vendasDepoisDe(desde: string): Promise<AvisoVenda[]> {
  if (bancoEmDemonstracao) return demo.filter((a) => a.em > desde).sort((a, b) => a.em.localeCompare(b.em));
  const { data, error } = await db()
    .from("configuracoes_loja")
    .select("valor")
    .like("chave", `${PREFIXO}%`)
    .gt("atualizado_em", desde)
    .order("atualizado_em", { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => r.valor as AvisoVenda);
}

/** Só o primeiro nome, como no aviso "Nova venda: R$ 37,90, Maria". */
function primeiroNome(nome: string): string {
  const n = nome.trim().split(/\s+/)[0] ?? "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "Cliente";
}
