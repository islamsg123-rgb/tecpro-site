/** Formato INTERNO do site Tecpro. As páginas só conhecem estes tipos. */

export interface Curso {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  /** Resumo curto para os cartões da vitrine */
  resumo: string;
  /** Preço em centavos (evita erros de arredondamento) */
  precoCentavos: number;
  capaUrl: string | null;
  cargaHoraria: number;
  categoria: string;
}

export interface Aula {
  id: string;
  titulo: string;
  modulo: string;
  ordem: number;
}

export interface Modulo {
  nome: string;
  aulas: Aula[];
}
