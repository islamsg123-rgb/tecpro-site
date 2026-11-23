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
    // A API responde {"erro": "", "resultado": ...}; "erro" preenchido indica falha.
    if (typeof json.erro === "string" && json.erro.trim()) {
      throw new ErroEscolaAvancada(`Escola Avançada recusou ${recurso}: ${json.erro}`);
    }
    return (json.resultado ?? json.dados ?? json.data ?? json) as T;
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

/** Regras da matrícula na Escola Avançada. */
export const configMatricula = {
  /** Liberar o certificado da própria Escola Avançada? O site já emite o certificado Tecpro. */
  certificadoNaEscola: false,
};

/** Acha o código do aluno na resposta de usuarios/novo, aceitando formatos comuns. */
function idDoAluno(r: unknown): string {
  if (typeof r === "string" || typeof r === "number") return String(r).trim();
  if (Array.isArray(r)) return r.length ? idDoAluno(r[0]) : "";
  if (r && typeof r === "object") {
    const o = r as Record<string, unknown>;
    for (const k of ["id", "aluno", "idaluno", "id_aluno", "usuario", "idusuario", "codigo"]) {
      const v = o[k];
      if ((typeof v === "string" || typeof v === "number") && String(v).trim()) return String(v).trim();
    }
    for (const v of Object.values(o)) {
      const dentro = idDoAluno(v);
      if (dentro && /^\d+$/.test(dentro)) return dentro;
    }
  }
  return "";
}

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
 * Cursos liberados para o aluno, via `usuarios/cursosvinculados` (campo confirmado: id_aluno).
 * A resposta pode não trazer o código do curso; nesse caso devolvemos "nome:<nome do curso>"
 * e a área do aluno faz a correspondência pelo nome.
 */
export async function cursosVinculados(usuarioId: string): Promise<string[]> {
  if (usandoDadosDeExemplo) return Array.from(vinculosDemo.get(usuarioId) ?? []);
  const r = await chamar<unknown>("usuarios/cursosvinculados", { id_aluno: usuarioId });
  const lista = (Array.isArray(r) ? r : r && typeof r === "object" ? Object.values(r) : []) as Record<string, unknown>[];
  return lista.flatMap((c) => {
    if (!c || typeof c !== "object") return [];
    for (const k of ["idcurso", "id_curso", "curso_id", "curso", "id"]) {
      const v = c[k];
      if ((typeof v === "string" || typeof v === "number") && /^\d+$/.test(String(v).trim())) return [String(v).trim()];
    }
    const capa = String(c.capa_image ?? c.capa ?? "");
    const doCapa = capa.match(/imagemcursos\/(\d+)\./)?.[1];
    if (doCapa) return [doCapa];
    const nome = String(c.nome ?? c.curso ?? "").trim();
    return nome ? [`nome:${nome}`] : [];
  });
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
  /** Prazo de acesso em meses (painel > Configurações); null = vitalício. */
  mesesDeAcesso: number | null = null,
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
    // Campos confirmados no manual (usuarios/novo).
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    // Vitalício: a Escola Avançada pede uma data, então usamos uma bem distante.
    const fim = new Date();
    if (mesesDeAcesso) fim.setMonth(fim.getMonth() + mesesDeAcesso);
    const final = mesesDeAcesso ? fim.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : "2099-12-31";
    const r = await chamar<unknown>("usuarios/novo", {
      nome: aluno.nome,
      email: aluno.email,
      cpf: aluno.cpf,
      fone: aluno.telefone,
      status: "ativo",
      apostila: "liberar",
      datacadastro: hoje,
      datafinal: final,
      certificado: configMatricula.certificadoNaEscola ? "S" : "N",
      bolsista: "N",
      funcionario_cadastro: "Site Tecpro",
      obs: "Cadastro automático pela compra no site Tecpro",
    });
    usuarioId = idDoAluno(r);
    if (!usuarioId) throw new Error("Escola Avançada não devolveu o código do aluno");
  }
  if ((await cursosVinculados(usuarioId)).includes(cursoId)) return { usuarioId, novoVinculo: false };
  // Campos confirmados no manual: vinculocurso {aluno, idcurso}; envioemail {aluno}.
  await chamar("usuarios/vinculocurso", { aluno: usuarioId, idcurso: cursoId });
  await chamar("usuarios/envioemail", { aluno: usuarioId });
  return { usuarioId, novoVinculo: true };
}
