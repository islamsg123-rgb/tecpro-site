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

/** Aceita "350,00", "1.350,00", "350.00" ou 350. */
function paraCentavos(valor: string | number): number {
  if (typeof valor === "number") return Math.round(valor * 100);
  let t = String(valor).replace(/[^\d.,-]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
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

/** "INFORMÁTICA E TECNOLOGIA" -> "Informática e Tecnologia" */
function tituloCategoria(t: string): string {
  const pequenas = new Set(["e", "de", "da", "do", "das", "dos"]);
  const r = t
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && pequenas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
  return r || "Geral";
}

/** Converte um item da API em Curso; devolve null se faltar id ou nome. */
export function adaptarCurso(raw: EACursoRaw): Curso | null {
  const nome = campo(raw, "nome", "titulo", "name", "title", "curso").trim();
  const capa = campo(raw, "capa_image", "capa", "imagem", "foto", "image", "thumb", "banner");
  // A API da Escola Avançada não manda o código do curso; ele aparece no nome da imagem da capa
  // (".../imagemcursos/16.jpg" -> 16). SUPOSIÇÃO a confirmar com cursos/aulas e com o suporte.
  const id =
    campo(raw, "id", "id_curso", "curso_id", "idcurso", "codigo", "cod", "cod_curso") ||
    (capa.match(/imagemcursos\/(\d+)\./)?.[1] ?? "");
  if (!id || !nome) return null;
  // Cursos inativos na Escola Avançada não aparecem no site.
  const status = campo(raw, "status", "situacao").toUpperCase();
  if (status && status !== "ATIVO") return null;
  const descricao = campo(raw, "descricao", "description", "resumo", "sobre", "obs");
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
    destaque: /^(destacar|sim|1|true)$/i.test(campo(raw, "destaque")),
    capaUrl: capa || null,
    cargaHoraria: parseInt(campo(raw, "carga_horaria", "cargahoraria", "carga", "horas", "duracao"), 10) || 0,
    categoria: tituloCategoria(campo(raw, "categoria_loja", "categoria", "categoria_interna", "category", "area")),
  };
}

export function adaptarAula(raw: EAAulaRaw, indice: number): Aula {
  return {
    id: campo(raw, "id", "id_aula", "aula_id", "codigo") || String(indice + 1),
    titulo: campo(raw, "aula", "titulo", "nome", "title", "name").trim() || `Aula ${indice + 1}`,
    modulo: campo(raw, "modulo", "modulo_nome", "secao", "capitulo").trim() || "Conteúdo do curso",
    ordem: Number(campo(raw, "ordem", "posicao", "order")) || indice + 1,
  };
}
