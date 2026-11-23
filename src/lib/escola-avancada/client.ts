import "server-only";
import type { EAAulaRaw, EACursoRaw, EAResposta } from "./types";
import { aulasMock, cursosMock } from "./mock";

/**
 * Conversa com a API V2 da Escola Avançada.
 * Sem ESCOLA_AVANCADA_TOKEN, devolve os dados de exemplo (mock.ts).
 * O token fica só no servidor; o navegador do visitante nunca o vê.
 */

// Aceita a variável com ou sem "/api/v2/?..." no fim: guarda só o começo do endereço.
const URL_BASE = process.env.ESCOLA_AVANCADA_URL?.trim()
  .replace(/\?.*$/, "")
  .replace(/\/api\/v2\/?$/i, "")
  .replace(/\/+$/, "");
const TOKEN = process.env.ESCOLA_AVANCADA_TOKEN;

export const usandoDadosDeExemplo = !URL_BASE || !TOKEN;

/** Endereço de um recurso. Confirmado no diagnóstico: POST em /api/v2/index.php?recurso, token no formulário. */
const endereco = (recurso: string) => `${URL_BASE}/api/v2/index.php?${recurso}`;

/** Erro da API da Escola Avançada, com um trecho da resposta para diagnóstico (sem o token). */
export class ErroEscolaAvancada extends Error {}

/** Resposta crua de um recurso: usada pela página de diagnóstico do painel. */
export async function respostaCrua(recurso: string, campos: Record<string, string> = {}) {
  const form = new FormData();
  form.set("token", TOKEN!); // Confirmado: o token vai no formulário.
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  const url = endereco(recurso);
  const resp = await fetch(url, { method: "POST", body: form, cache: "no-store" });
  const texto = await resp.text();
  return { url, status: resp.status, texto };
}

/** Acha a lista dentro da resposta, aceitando formatos comuns: [..], {dados:[..]}, {data:[..]}, etc. */
function extrairLista(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    for (const chave of ["resultado", "dados", "data", "cursos", "aulas", "result", "resultado", "items"]) {
      const v = o[chave];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") {
        const dentro = extrairLista(v);
        if (dentro) return dentro;
      }
    }
    // Objeto de objetos ({"1": {...}, "2": {...}})
    const valores = Object.values(o);
    if (valores.length && valores.every((v) => v && typeof v === "object" && !Array.isArray(v))) return valores;
  }
  return null;
}

async function chamarLista<T>(recurso: string, campos: Record<string, string> = {}, guardarCache = false): Promise<T[]> {
  const form = new FormData();
  form.set("token", TOKEN!); // Confirmado: o token vai no formulário.
  for (const [k, v] of Object.entries(campos)) form.set(k, v);

  const resp = await fetch(endereco(recurso), {
    method: "POST",
    body: form,
    // Guarda a resposta por 10 minutos para o site ficar rápido e não sobrecarregar a API.
    ...(guardarCache ? { next: { revalidate: 600 } } : { cache: "no-store" as const }),
  });
  const texto = await resp.text();
  if (!resp.ok) throw new ErroEscolaAvancada(`HTTP ${resp.status} em ${recurso}: ${texto.slice(0, 300)}`);
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new ErroEscolaAvancada(`Resposta não é JSON em ${recurso}: ${texto.slice(0, 300)}`);
  }
  const lista = extrairLista(json);
  if (!lista) throw new ErroEscolaAvancada(`Formato inesperado em ${recurso}: ${texto.slice(0, 300)}`);
  return lista as T[];
}

/** Chama a API sem derrubar o site: se falhar, registra no log e devolve lista vazia. */
async function listaSegura<T>(recurso: string, campos: Record<string, string> = {}): Promise<T[]> {
  try {
    return await chamarLista<T>(recurso, campos, true);
  } catch (e) {
    console.error("[escola-avancada]", e instanceof Error ? e.message : e);
    return [];
  }
}

async function chamar<T>(recurso: string, campos: Record<string, string> = {}): Promise<T> {
  const r = await respostaCrua(recurso, campos);
  if (r.status >= 400) throw new ErroEscolaAvancada(`HTTP ${r.status} em ${recurso}: ${r.texto.slice(0, 300)}`);
  try {
    const json = JSON.parse(r.texto) as EAResposta<T> & Record<string, unknown>;
    return (json.dados ?? json.data ?? json) as T;
  } catch {
    throw new ErroEscolaAvancada(`Resposta não é JSON em ${recurso}: ${r.texto.slice(0, 300)}`);
  }
}

export async function listarCursosRaw(): Promise<EACursoRaw[]> {
  if (usandoDadosDeExemplo) return cursosMock;
  return listaSegura<EACursoRaw>("cursos/listar");
}

export async function listarAulasRaw(cursoId: string): Promise<EAAulaRaw[]> {
  if (usandoDadosDeExemplo) return aulasMock[cursoId] ?? [];
  return listaSegura<EAAulaRaw>("cursos/aulas", { curso: cursoId });
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
