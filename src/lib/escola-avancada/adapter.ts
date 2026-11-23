import type { EAAulaRaw, EACursoRaw } from "./types";
import type { Aula, Curso } from "../types";

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function paraCentavos(valor: string | number): number {
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function textoSimples(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function resumir(texto: string, max = 140): string {
  const t = textoSimples(texto);
  if (t.length <= max) return t;
  return t.slice(0, t.lastIndexOf(" ", max)) + "…";
}

/** Pega o primeiro campo preenchido entre vários nomes possíveis (a API real pode usar outro nome). */
function campo(raw: object, ...nomes: string[]): string {
  const o = raw as Record<string, unknown>;
  for (const n of nomes) {
    const v = o[n];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
}

/** Converte um item da API em Curso; devolve null se faltar id ou nome. */
export function adaptarCurso(raw: EACursoRaw): Curso | null {
  const id = campo(raw, "id", "id_curso", "curso_id", "codigo");
  const nome = campo(raw, "nome", "titulo", "name", "title", "curso").trim();
  if (!id || !nome) return null;
  const descricao = campo(raw, "descricao", "description", "resumo", "sobre");
  const valor = campo(raw, "valor", "preco", "price", "valor_venda");
  return {
    id,
    // O id no fim garante que o link é único mesmo se dois cursos tiverem o mesmo nome.
    slug: `${slugify(nome)}-${slugify(id)}`,
    nome,
    descricao,
    resumo: resumir(descricao),
    precoCentavos: paraCentavos(valor),
    precoEscolaCentavos: paraCentavos(valor),
    visivel: true,
    destaque: false,
    capaUrl: campo(raw, "capa", "imagem", "foto", "image", "thumb", "banner") || null,
    cargaHoraria: parseInt(campo(raw, "carga_horaria", "cargahoraria", "carga", "horas", "duracao"), 10) || 0,
    categoria: campo(raw, "categoria", "category", "area").trim() || "Geral",
  };
}

export function adaptarAula(raw: EAAulaRaw, indice: number): Aula {
  return {
    id: campo(raw, "id", "id_aula", "aula_id", "codigo") || String(indice + 1),
    titulo: campo(raw, "titulo", "nome", "title", "name").trim() || `Aula ${indice + 1}`,
    modulo: campo(raw, "modulo", "modulo_nome", "secao", "capitulo").trim() || "Conteúdo do curso",
    ordem: Number(campo(raw, "ordem", "posicao", "order")) || indice + 1,
  };
}
