import "server-only";
import { bancoEmDemonstracao, db } from "./index";

/**
 * Aulas liberadas pelo painel (quando a aula está com problema e o aluno não consegue avançar,
 * por exemplo uma questão da prova com gabarito errado).
 * A aula fica concluída normalmente na tabela "progresso"; aqui fica só o registro de quem liberou,
 * quando e por quê. Guardado em configuracoes_loja, uma chave por aluno ("aulas_liberadas:<e-mail>"),
 * então não precisa de SQL novo.
 */

export interface AulaLiberada {
  cursoId: string;
  aulaId: string;
  cursoNome: string;
  aulaTitulo: string;
  /** Posição da aula no curso (1, 2, 3...). */
  numero: number;
  quem: string;
  quando: string;
  motivo: string | null;
  desfeitaEm?: string;
  desfeitaPor?: string;
}

const PREFIXO = "aulas_liberadas:";
const LIMITE = 300;
const norm = (e: string) => e.trim().toLowerCase();
const g = globalThis as unknown as { __aulasLiberadasDemo?: Map<string, AulaLiberada[]> };
const mem = () => (g.__aulasLiberadasDemo ??= new Map());

/** Mais recentes primeiro. */
export async function aulasLiberadasDoAluno(emailAluno: string): Promise<AulaLiberada[]> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) return mem().get(email) ?? [];
  const { data, error } = await db().from("configuracoes_loja").select("valor").eq("chave", PREFIXO + email).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.valor) ? (data.valor as AulaLiberada[]) : [];
}

async function salvar(email: string, lista: AulaLiberada[]): Promise<void> {
  const valor = lista.slice(0, LIMITE);
  if (bancoEmDemonstracao) {
    mem().set(email, valor);
    return;
  }
  const { error } = await db()
    .from("configuracoes_loja")
    .upsert({ chave: PREFIXO + email, valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw error;
}

export async function registrarAulaLiberada(emailAluno: string, item: Omit<AulaLiberada, "quando">): Promise<void> {
  const email = norm(emailAluno);
  const atuais = await aulasLiberadasDoAluno(email);
  await salvar(email, [{ ...item, quando: new Date().toISOString() }, ...atuais]);
}

/** Marca como desfeita a liberação ativa mais recente desta aula. */
export async function registrarLiberacaoDesfeita(emailAluno: string, cursoId: string, aulaId: string, quem: string): Promise<void> {
  const email = norm(emailAluno);
  const atuais = await aulasLiberadasDoAluno(email);
  const i = atuais.findIndex((a) => a.cursoId === cursoId && a.aulaId === aulaId && !a.desfeitaEm);
  if (i < 0) return;
  atuais[i] = { ...atuais[i], desfeitaEm: new Date().toISOString(), desfeitaPor: quem };
  await salvar(email, atuais);
}
