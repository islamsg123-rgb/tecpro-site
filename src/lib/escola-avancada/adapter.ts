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

export function adaptarCurso(raw: EACursoRaw): Curso {
  const id = String(raw.id);
  return {
    id,
    // O id no fim garante que o link é único mesmo se dois cursos tiverem o mesmo nome.
    slug: `${slugify(raw.nome)}-${id}`,
    nome: raw.nome.trim(),
    descricao: raw.descricao ?? "",
    resumo: resumir(raw.descricao ?? ""),
    precoCentavos: paraCentavos(raw.valor),
    precoEscolaCentavos: paraCentavos(raw.valor),
    visivel: true,
    destaque: false,
    capaUrl: raw.capa ? raw.capa : null,
    cargaHoraria: Number(raw.carga_horaria) || 0,
    categoria: raw.categoria?.trim() || "Geral",
  };
}

export function adaptarAula(raw: EAAulaRaw, indice: number): Aula {
  return {
    id: String(raw.id),
    titulo: raw.titulo.trim(),
    modulo: raw.modulo?.trim() || "Conteúdo do curso",
    ordem: Number(raw.ordem) || indice + 1,
  };
}
