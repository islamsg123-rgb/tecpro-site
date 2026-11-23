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

async function chamar<T>(recurso: string, campos: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  form.set("token", TOKEN!); // SUPOSIÇÃO: confirmar se o token vai no corpo ou no cabeçalho.
  for (const [k, v] of Object.entries(campos)) form.set(k, v);

  const resp = await fetch(`${URL_BASE}/api/v2/?${recurso}`, {
    method: "POST",
    body: form,
    // Guarda a resposta por 10 minutos para o site ficar rápido e não sobrecarregar a API.
    next: { revalidate: 600 },
  });
  if (!resp.ok) throw new Error(`Escola Avançada respondeu ${resp.status} em ${recurso}`);
  const json = (await resp.json()) as EAResposta<T>;
  return json.dados;
}

export async function listarCursosRaw(): Promise<EACursoRaw[]> {
  if (usandoDadosDeExemplo) return cursosMock;
  return chamar<EACursoRaw[]>("cursos/listar");
}

export async function listarAulasRaw(cursoId: string): Promise<EAAulaRaw[]> {
  if (usandoDadosDeExemplo) return aulasMock[cursoId] ?? [];
  return chamar<EAAulaRaw[]>("cursos/aulas", { curso: cursoId });
}
