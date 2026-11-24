import "server-only";
import { bancoEmDemonstracao, db } from "./index";

/**
 * Carrinhos (quem começou o checkout), cupons e mensagens prontas de WhatsApp.
 * Tabelas criadas por supabase/migrations/0006_carrinhos_cupons.sql.
 * Se a tabela ainda não existir, o checkout continua funcionando: só não registramos.
 */

const norm = (email: string) => email.trim().toLowerCase();

/* ---------- Carrinhos ---------- */

export type EtapaCarrinho = "contato" | "pagamento" | "pago" | "matriculado";
export type TipoCarrinho = "curso" | "certificado";

export interface Carrinho {
  email: string;
  cursoId: string;
  tipo: TipoCarrinho;
  nome: string | null;
  telefone: string | null;
  etapa: EtapaCarrinho;
  forma: string | null;
  cobrancaId: string | null;
  valorCentavos: number | null;
  cupom: string | null;
  contatadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

const gMem = globalThis as unknown as { __carrinhosDemo?: Map<string, Carrinho>; __cuponsDemo?: Map<string, Cupom> };
const memCarrinhos = () => (gMem.__carrinhosDemo ??= new Map());
const chave = (email: string, cursoId: string, tipo: string) => `${norm(email)}|${cursoId}|${tipo}`;

type Linha = Record<string, unknown>;
const daLinha = (r: Linha): Carrinho => ({
  email: String(r.email), cursoId: String(r.curso_id), tipo: r.tipo as TipoCarrinho,
  nome: (r.nome as string) ?? null, telefone: (r.telefone as string) ?? null, etapa: r.etapa as EtapaCarrinho,
  forma: (r.forma as string) ?? null, cobrancaId: (r.cobranca_id as string) ?? null,
  valorCentavos: (r.valor_centavos as number) ?? null, cupom: (r.cupom as string) ?? null,
  contatadoEm: (r.contatado_em as string) ?? null, criadoEm: String(r.criado_em), atualizadoEm: String(r.atualizado_em),
});

const ORDEM: EtapaCarrinho[] = ["contato", "pagamento", "pago", "matriculado"];

/**
 * Registra ou avança a etapa do carrinho. Nunca derruba o checkout.
 * Uma etapa "menor" não apaga uma maior (ex.: quem já pagou e volta ao checkout continua como pago),
 * exceto quando a pessoa recomeça depois de ter pago — aí vale como nova tentativa.
 */
export async function registrarCarrinho(
  dados: { email: string; cursoId: string; tipo: TipoCarrinho; etapa: EtapaCarrinho } & Partial<
    Pick<Carrinho, "nome" | "telefone" | "forma" | "cobrancaId" | "valorCentavos" | "cupom">
  >,
): Promise<void> {
  const email = norm(dados.email);
  const agora = new Date().toISOString();
  try {
    const atual = await obterCarrinho(email, dados.cursoId, dados.tipo);
    const finalizado = atual && (atual.etapa === "pago" || atual.etapa === "matriculado");
    // Avisos repetidos de pagamento não voltam a etapa para trás.
    if (atual && !finalizado && ORDEM.indexOf(dados.etapa) < ORDEM.indexOf(atual.etapa)) return;
    // Depois de concluído, só uma nova tentativa (preencher o contato de novo) reabre o carrinho.
    if (finalizado && dados.etapa !== "contato") return;
    const novo: Carrinho = {
      email, cursoId: dados.cursoId, tipo: dados.tipo,
      nome: dados.nome ?? atual?.nome ?? null,
      telefone: dados.telefone ?? atual?.telefone ?? null,
      etapa: dados.etapa,
      forma: dados.forma ?? (dados.etapa === "contato" ? null : atual?.forma ?? null),
      cobrancaId: dados.cobrancaId ?? (dados.etapa === "contato" ? null : atual?.cobrancaId ?? null),
      valorCentavos: dados.valorCentavos ?? atual?.valorCentavos ?? null,
      cupom: dados.cupom !== undefined ? dados.cupom : atual?.cupom ?? null,
      // Nova tentativa depois de uma compra concluída: zera o "já contatado".
      contatadoEm: finalizado ? null : atual?.contatadoEm ?? null,
      criadoEm: finalizado || !atual ? agora : atual.criadoEm,
      atualizadoEm: agora,
    };
    if (bancoEmDemonstracao) {
      memCarrinhos().set(chave(email, dados.cursoId, dados.tipo), novo);
      return;
    }
    const { error } = await db().from("carrinhos").upsert(
      {
        email, curso_id: novo.cursoId, tipo: novo.tipo, nome: novo.nome, telefone: novo.telefone, etapa: novo.etapa,
        forma: novo.forma, cobranca_id: novo.cobrancaId, valor_centavos: novo.valorCentavos, cupom: novo.cupom,
        contatado_em: novo.contatadoEm, criado_em: novo.criadoEm, atualizado_em: novo.atualizadoEm,
      },
      { onConflict: "email,curso_id,tipo" },
    );
    if (error) throw error;
  } catch (e) {
    console.error("[carrinhos] não registrado:", e instanceof Error ? e.message : e);
  }
}

export async function obterCarrinho(email: string, cursoId: string, tipo: TipoCarrinho): Promise<Carrinho | null> {
  if (bancoEmDemonstracao) return memCarrinhos().get(chave(email, cursoId, tipo)) ?? null;
  const { data, error } = await db()
    .from("carrinhos").select("*").eq("email", norm(email)).eq("curso_id", cursoId).eq("tipo", tipo).maybeSingle();
  if (error) throw error;
  return data ? daLinha(data) : null;
}

export async function listarCarrinhos(limite = 500): Promise<{ lista: Carrinho[]; tabelaFaltando: boolean }> {
  if (bancoEmDemonstracao) {
    return { lista: Array.from(memCarrinhos().values()).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)), tabelaFaltando: false };
  }
  const { data, error } = await db().from("carrinhos").select("*").order("atualizado_em", { ascending: false }).limit(limite);
  if (error) {
    console.error("[carrinhos]", error.message);
    return { lista: [], tabelaFaltando: true };
  }
  return { lista: (data ?? []).map(daLinha), tabelaFaltando: false };
}

export async function marcarContatado(email: string, cursoId: string, tipo: TipoCarrinho, contatado: boolean): Promise<void> {
  const quando = contatado ? new Date().toISOString() : null;
  if (bancoEmDemonstracao) {
    const c = memCarrinhos().get(chave(email, cursoId, tipo));
    if (c) c.contatadoEm = quando;
    return;
  }
  const { error } = await db().from("carrinhos").update({ contatado_em: quando })
    .eq("email", norm(email)).eq("curso_id", cursoId).eq("tipo", tipo);
  if (error) throw error;
}

/* ---------- Cupons ---------- */

export interface Cupom {
  codigo: string;
  tipo: "percentual" | "valor";
  /** Percentual (1 a 100) ou valor em centavos */
  valor: number;
  aplicaEm: "tudo" | "cursos" | "certificados";
  cursoId: string | null;
  validade: string | null; // AAAA-MM-DD
  limiteUsos: number | null;
  usos: number;
  ativo: boolean;
  criadoEm: string;
}

const memCupons = () => (gMem.__cuponsDemo ??= new Map());
const cupomDaLinha = (r: Linha): Cupom => ({
  codigo: String(r.codigo), tipo: r.tipo as Cupom["tipo"], valor: Number(r.valor), aplicaEm: r.aplica_em as Cupom["aplicaEm"],
  cursoId: (r.curso_id as string) ?? null, validade: (r.validade as string) ?? null, limiteUsos: (r.limite_usos as number) ?? null,
  usos: Number(r.usos ?? 0), ativo: Boolean(r.ativo), criadoEm: String(r.criado_em),
});

export const normCupom = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "");

export async function listarCupons(): Promise<{ lista: Cupom[]; tabelaFaltando: boolean }> {
  if (bancoEmDemonstracao) return { lista: Array.from(memCupons().values()), tabelaFaltando: false };
  const { data, error } = await db().from("cupons").select("*").order("criado_em", { ascending: false });
  if (error) {
    console.error("[cupons]", error.message);
    return { lista: [], tabelaFaltando: true };
  }
  return { lista: (data ?? []).map(cupomDaLinha), tabelaFaltando: false };
}

export async function obterCupom(codigo: string): Promise<Cupom | null> {
  const c = normCupom(codigo);
  if (!c) return null;
  if (bancoEmDemonstracao) return memCupons().get(c) ?? null;
  const { data, error } = await db().from("cupons").select("*").eq("codigo", c).maybeSingle();
  if (error) {
    console.error("[cupons]", error.message);
    return null;
  }
  return data ? cupomDaLinha(data) : null;
}

export async function salvarCupom(c: Omit<Cupom, "usos" | "criadoEm">): Promise<void> {
  if (bancoEmDemonstracao) {
    const antigo = memCupons().get(c.codigo);
    memCupons().set(c.codigo, { ...c, usos: antigo?.usos ?? 0, criadoEm: antigo?.criadoEm ?? new Date().toISOString() });
    return;
  }
  const { error } = await db().from("cupons").upsert(
    {
      codigo: c.codigo, tipo: c.tipo, valor: c.valor, aplica_em: c.aplicaEm, curso_id: c.cursoId,
      validade: c.validade, limite_usos: c.limiteUsos, ativo: c.ativo,
    },
    { onConflict: "codigo" },
  );
  if (error) throw error;
}

export async function apagarCupom(codigo: string): Promise<void> {
  if (bancoEmDemonstracao) {
    memCupons().delete(codigo);
    return;
  }
  const { error } = await db().from("cupons").delete().eq("codigo", codigo);
  if (error) throw error;
}

/** Conta um uso (quando a cobrança com o cupom é gerada). */
export async function contarUsoCupom(codigo: string): Promise<void> {
  try {
    const c = await obterCupom(codigo);
    if (!c) return;
    if (bancoEmDemonstracao) {
      c.usos += 1;
      return;
    }
    await db().from("cupons").update({ usos: c.usos + 1 }).eq("codigo", c.codigo);
  } catch (e) {
    console.error("[cupons] uso não contado:", e instanceof Error ? e.message : e);
  }
}

/* ---------- Mensagens prontas de WhatsApp (painel) ---------- */

export interface MensagemPronta {
  titulo: string;
  texto: string;
}

export const MENSAGENS_PADRAO: MensagemPronta[] = [
  {
    titulo: "Lembrete simples",
    texto: "Oi, {nome}! Aqui é da Tecpro. Vi que você começou a matrícula no curso {curso} e não terminou. Ficou alguma dúvida? Posso te ajudar por aqui. Link: {link}",
  },
  {
    titulo: "Oferta com cupom",
    texto: "Oi, {nome}! Separei um desconto especial para você concluir sua matrícula em {curso}: use o cupom {cupom} no pagamento. Vale por pouco tempo! {link}",
  },
  {
    titulo: "Pix ou boleto em aberto",
    texto: "Oi, {nome}! Seu pagamento do curso {curso} ainda está em aberto. Se preferir, posso gerar outra forma de pagamento (Pix, boleto ou cartão em até 12x). {link}",
  },
  {
    titulo: "Certificado",
    texto: "Oi, {nome}! Parabéns por concluir o curso {curso}! Seu certificado está pronto para ser liberado na área do aluno: {link}",
  },
];

const gMsg = globalThis as unknown as { __mensagensDemo?: MensagemPronta[] };

export async function mensagensProntas(): Promise<MensagemPronta[]> {
  if (bancoEmDemonstracao) return gMsg.__mensagensDemo ?? MENSAGENS_PADRAO;
  const { data } = await db().from("configuracoes_loja").select("valor").eq("chave", "mensagens_whatsapp").maybeSingle();
  return Array.isArray(data?.valor) && data.valor.length ? (data.valor as MensagemPronta[]) : MENSAGENS_PADRAO;
}

export async function salvarMensagensProntas(lista: MensagemPronta[]): Promise<void> {
  if (bancoEmDemonstracao) {
    gMsg.__mensagensDemo = lista;
    return;
  }
  const { error } = await db()
    .from("configuracoes_loja")
    .upsert({ chave: "mensagens_whatsapp", valor: lista, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw error;
}
