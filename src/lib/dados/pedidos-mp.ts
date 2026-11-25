import "server-only";
import { bancoEmDemonstracao, db } from "./index";
import type { Comprador, FormaPagamento, Situacao } from "../pagamentos/tipos";

/**
 * Pedidos do Mercado Pago guardados no nosso banco.
 * A API de pedidos ("Orders") do Mercado Pago não tem campo livre (metadata) e o external_reference só aceita
 * letras e números, então o que foi comprado e os dados do comprador ficam aqui, ligados ao código do pedido.
 * Usa a tabela configuracoes_loja (chave "mppedido:<código>"), sem precisar de SQL novo.
 */

export interface PedidoMp {
  id: string; // código do pedido no Mercado Pago (ORD...)
  referencia: string; // referenciaProduto(): o que foi comprado
  comprador: Comprador;
  forma: FormaPagamento;
  valorCentavos: number;
  descricao: string;
  criadoEm: string;
  vencimento: string;
  /** Última situação conhecida (atualizada pelo aviso automático e pelas consultas) */
  situacao: Situacao;
  pagoEm?: string;
  parcelas?: number;
  /** Taxa, líquido e data de liberação informados pelo Mercado Pago (consultados depois do pagamento) */
  taxaCentavos?: number;
  liquidoCentavos?: number;
  liberaEm?: string;
  /** Última tentativa de buscar a taxa real (ISO); evita perguntar toda hora quando o Mercado Pago não responde */
  taxaConsultadaEm?: string;
}

const PREFIXO = "mppedido:";
const g = globalThis as unknown as { __pedidosMpDemo?: Map<string, PedidoMp> };
const demo = (g.__pedidosMpDemo ??= new Map());

export async function salvarPedidoMp(p: PedidoMp): Promise<void> {
  if (bancoEmDemonstracao) {
    demo.set(p.id, p);
    return;
  }
  const { error } = await db()
    .from("configuracoes_loja")
    .upsert({ chave: PREFIXO + p.id, valor: p, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw error;
}

export async function obterPedidoMp(id: string): Promise<PedidoMp | null> {
  if (bancoEmDemonstracao) return demo.get(id) ?? null;
  const { data, error } = await db().from("configuracoes_loja").select("valor").eq("chave", PREFIXO + id).maybeSingle();
  if (error) throw error;
  return (data?.valor as PedidoMp | undefined) ?? null;
}

/** Pedidos mais recentes primeiro. */
export async function listarPedidosMp(limite = 300): Promise<PedidoMp[]> {
  if (bancoEmDemonstracao) {
    return Array.from(demo.values()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, limite);
  }
  const { data, error } = await db()
    .from("configuracoes_loja")
    .select("valor")
    .like("chave", `${PREFIXO}%`)
    .order("atualizado_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map((r) => r.valor as PedidoMp).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}
