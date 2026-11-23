/**
 * Formato BRUTO (como chega) da API V2 da Escola Avançada.
 *
 * ATENÇÃO: os nomes dos campos abaixo são uma SUPOSIÇÃO baseada na documentação
 * pública (Postman). Quando tivermos a chave da API, conferimos uma resposta real
 * e ajustamos só este arquivo e o `adapter.ts`. O resto do site não muda.
 */

/** Item de `?cursos/listar` */
export interface EACursoRaw {
  id: string | number;
  nome: string;
  descricao: string;
  /** Preço como texto ou número, ex.: "197.00" */
  valor: string | number;
  /** URL da imagem de capa */
  capa: string;
  /** Carga horária em horas, ex.: "40" */
  carga_horaria: string | number;
  /** Categoria/área, se a API enviar */
  categoria?: string;
}

/** Item de `?cursos/aulas` (a API só entrega títulos, sem vídeo) */
export interface EAAulaRaw {
  id: string | number;
  titulo: string;
  modulo?: string;
  ordem?: string | number;
}

/** Envelope genérico de resposta */
export interface EAResposta<T> {
  status: string | boolean;
  dados: T;
  mensagem?: string;
}
