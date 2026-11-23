import "server-only";
import type { EAAulaRaw, EACursoRaw, EAResposta } from "./types";
import { aulasMock, cursosMock } from "./mock";

/**
 * Conversa com a API V2 da Escola Avançada.
 * Sem ESCOLA_AVANCADA_TOKEN, devolve os dados de exemplo (mock.ts).
 * O token fica só no servidor; o navegador do visitante nunca o vê.
 */

const URL_BASE = process.env.ESCOLA_AVANCADA_URL?.replace(/\/$/, "");
const TOKEN = process.env.ESCOLA_AVANCADA_TOKEN;

export const usandoDadosDeExemplo = !URL_BASE || !TOKEN;

async function chamar<T>(recurso: string, campos: Record<string, string> = {}, guardarCache = false): Promise<T> {
  const form = new FormData();
  form.set("token", TOKEN!); // SUPOSIÇÃO: confirmar se o token vai no corpo ou no cabeçalho.
  for (const [k, v] of Object.entries(campos)) form.set(k, v);

  const resp = await fetch(`${URL_BASE}/api/v2/?${recurso}`, {
    method: "POST",
    body: form,
    // Guarda a resposta por 10 minutos para o site ficar rápido e não sobrecarregar a API.
    ...(guardarCache ? { next: { revalidate: 600 } } : { cache: "no-store" as const }),
  });
  if (!resp.ok) throw new Error(`Escola Avançada respondeu ${resp.status} em ${recurso}`);
  const json = (await resp.json()) as EAResposta<T>;
  return json.dados;
}

export async function listarCursosRaw(): Promise<EACursoRaw[]> {
  if (usandoDadosDeExemplo) return cursosMock;
  return chamar<EACursoRaw[]>("cursos/listar", {}, true);
}

export async function listarAulasRaw(cursoId: string): Promise<EAAulaRaw[]> {
  if (usandoDadosDeExemplo) return aulasMock[cursoId] ?? [];
  return chamar<EAAulaRaw[]>("cursos/aulas", { curso: cursoId }, true);
}

/* ---------- Matrícula (usada depois que o pagamento é confirmado) ---------- */

export interface NovoAluno {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
}

/**
 * Cria o aluno (ou reaproveita, se já existir), libera o curso e dispara o e-mail de acesso.
 * SUPOSIÇÃO: nomes dos campos e formato da resposta. Conferir com a API real.
 */
export async function matricularAluno(aluno: NovoAluno, cursoId: string): Promise<{ usuarioId: string }> {
  if (usandoDadosDeExemplo) {
    console.info(`[escola-avancada:simulação] matricular ${aluno.email} no curso ${cursoId}`);
    return { usuarioId: `sim-${aluno.cpf}` };
  }
  const usuario = await chamar<{ id?: string | number; usuario?: string | number }>("usuarios/novo", {
    nome: aluno.nome,
    email: aluno.email,
    cpf: aluno.cpf,
    telefone: aluno.telefone,
  });
  const usuarioId = String(usuario.id ?? usuario.usuario ?? "");
  if (!usuarioId) throw new Error("Escola Avançada não devolveu o id do aluno");
  await chamar("usuarios/vinculocurso", { usuario: usuarioId, curso: cursoId });
  await chamar("usuarios/envioemail", { usuario: usuarioId });
  return { usuarioId };
}
