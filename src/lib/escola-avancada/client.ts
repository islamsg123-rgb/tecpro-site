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

/* ---------- Alunos e matrículas (a Escola Avançada é a fonte oficial) ---------- */

export interface NovoAluno {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
}

// Simulação: vínculos aluno -> cursos, já com o aluno de demonstração em dois cursos.
const g = globalThis as unknown as { __vinculosDemo?: Map<string, Set<string>> };
const vinculosDemo = (g.__vinculosDemo ??= new Map([["sim-demo", new Set(["101", "104"])]]));

/**
 * IDs dos cursos liberados para o aluno, via `usuarios/cursosvinculados`.
 * SUPOSIÇÃO: nome do campo do usuário e formato da resposta. Conferir com a API real.
 */
export async function cursosVinculados(usuarioId: string): Promise<string[]> {
  if (usandoDadosDeExemplo) return Array.from(vinculosDemo.get(usuarioId) ?? []);
  const lista = await chamar<{ curso?: string | number; id?: string | number; situacao?: string }[]>(
    "usuarios/cursosvinculados",
    { usuario: usuarioId },
  );
  return (lista ?? []).map((c) => String(c.curso ?? c.id));
}

/**
 * Garante que o aluno existe e tem o curso liberado na Escola Avançada.
 * Seguro para chamar mais de uma vez: só cria o aluno se ainda não tiver o código dele,
 * e só vincula (e dispara o e-mail de acesso) se o curso ainda não estiver vinculado.
 * SUPOSIÇÃO: nomes dos campos e formato das respostas. Conferir com a API real.
 */
export async function matricularAluno(
  aluno: NovoAluno,
  cursoId: string,
  usuarioIdExistente?: string,
): Promise<{ usuarioId: string; novoVinculo: boolean }> {
  let usuarioId = usuarioIdExistente;

  if (usandoDadosDeExemplo) {
    usuarioId ??= `sim-${aluno.cpf || aluno.email}`;
    const cursos = vinculosDemo.get(usuarioId) ?? new Set<string>();
    const novoVinculo = !cursos.has(cursoId);
    cursos.add(cursoId);
    vinculosDemo.set(usuarioId, cursos);
    if (novoVinculo) console.info(`[escola-avancada:simulação] curso ${cursoId} liberado para ${aluno.email}`);
    return { usuarioId, novoVinculo };
  }

  if (!usuarioId) {
    const r = await chamar<{ id?: string | number; usuario?: string | number }>("usuarios/novo", {
      nome: aluno.nome,
      email: aluno.email,
      cpf: aluno.cpf,
      telefone: aluno.telefone,
    });
    usuarioId = String(r.id ?? r.usuario ?? "");
    if (!usuarioId) throw new Error("Escola Avançada não devolveu o código do aluno");
  }
  if ((await cursosVinculados(usuarioId)).includes(cursoId)) return { usuarioId, novoVinculo: false };
  await chamar("usuarios/vinculocurso", { usuario: usuarioId, curso: cursoId });
  await chamar("usuarios/envioemail", { usuario: usuarioId });
  return { usuarioId, novoVinculo: true };
}
