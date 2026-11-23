/** Formato INTERNO do site Tecpro. As páginas só conhecem estes tipos. */

export interface Curso {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  /** Resumo curto para os cartões da vitrine */
  resumo: string;
  /** Preço de venda da Tecpro, em centavos (evita erros de arredondamento) */
  precoCentavos: number;
  /** Preço que veio da Escola Avançada, antes do ajuste do painel */
  precoEscolaCentavos: number;
  /** Aparece na vitrine (painel de administração) */
  visivel: boolean;
  /** Vai para o topo e para "Mais procurados" (painel de administração) */
  destaque: boolean;
  /** Curso gratuito: matrícula sem pagamento; só o certificado é cobrado no final (painel de administração) */
  gratuito: boolean;
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
