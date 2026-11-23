import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Banco MÍNIMO do site (Supabase). Cadastro e matrículas ficam na Escola Avançada;
 * aqui só guardamos:
 *  - o vínculo entre o e-mail de login e o código do aluno na Escola Avançada;
 *  - as aulas concluídas.
 * Sem SUPABASE_SERVICE_ROLE_KEY, usa um banco de DEMONSTRAÇÃO em memória.
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE_SERVICO = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const bancoEmDemonstracao = !URL_SUPABASE || !CHAVE_SERVICO;

export const EMAIL_DEMO = "aluno@demo.tecpro";

const norm = (email: string) => email.trim().toLowerCase();

let cliente: SupabaseClient | null = null;
function db(): SupabaseClient {
  cliente ??= createClient(URL_SUPABASE!, CHAVE_SERVICO!, { auth: { persistSession: false } });
  return cliente;
}

/* ---------- Demonstração (memória) ---------- */
interface Memoria {
  alunos: Map<string, { eaUsuarioId: string; nome: string | null }>;
  progresso: Map<string, Set<string>>; // "email|curso" -> aulas concluídas
}
const g = globalThis as unknown as { __bancoDemo?: Memoria };
const mem: Memoria = (g.__bancoDemo ??= {
  alunos: new Map([[EMAIL_DEMO, { eaUsuarioId: "sim-demo", nome: "Aluno Demonstração" }]]),
  progresso: new Map([
    [`${EMAIL_DEMO}|101`, new Set(["Excel-1", "Excel-2", "Excel-3", "Excel-4", "Excel-5", "Excel-6", "Excel-7"])],
    [`${EMAIL_DEMO}|104`, new Set(["Design-1"])],
  ]),
});

/* ---------- Alunos ---------- */

export interface RegistroAluno {
  email: string;
  eaUsuarioId: string;
  nome: string | null;
}

export async function obterAluno(emailAluno: string): Promise<RegistroAluno | null> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) {
    const a = mem.alunos.get(email);
    return a ? { email, ...a } : null;
  }
  const { data, error } = await db().from("alunos").select("email, ea_usuario_id, nome").eq("email", email).maybeSingle();
  if (error) throw error;
  return data ? { email: data.email, eaUsuarioId: data.ea_usuario_id, nome: data.nome } : null;
}

export async function salvarAluno(a: RegistroAluno): Promise<void> {
  const email = norm(a.email);
  if (bancoEmDemonstracao) {
    mem.alunos.set(email, { eaUsuarioId: a.eaUsuarioId, nome: a.nome });
    return;
  }
  const { error } = await db()
    .from("alunos")
    .upsert({ email, ea_usuario_id: a.eaUsuarioId, nome: a.nome }, { onConflict: "email" });
  if (error) throw error;
}

/* ---------- Progresso ---------- */

export async function aulasConcluidas(emailAluno: string, cursoId: string): Promise<Set<string>> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) return new Set(mem.progresso.get(`${email}|${cursoId}`) ?? []);
  const { data, error } = await db().from("progresso").select("aula_id").eq("email", email).eq("curso_id", cursoId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.aula_id as string));
}

export async function definirAulaConcluida(emailAluno: string, cursoId: string, aulaId: string, concluida: boolean): Promise<void> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) {
    const chave = `${email}|${cursoId}`;
    const s = mem.progresso.get(chave) ?? new Set<string>();
    if (concluida) s.add(aulaId);
    else s.delete(aulaId);
    mem.progresso.set(chave, s);
    return;
  }
  const t = db().from("progresso");
  const { error } = concluida
    ? await t.upsert({ email, curso_id: cursoId, aula_id: aulaId }, { onConflict: "email,curso_id,aula_id", ignoreDuplicates: true })
    : await t.delete().eq("email", email).eq("curso_id", cursoId).eq("aula_id", aulaId);
  if (error) throw error;
}
