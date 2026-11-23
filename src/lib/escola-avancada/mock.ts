import type { EAAulaRaw, EACursoRaw } from "./types";

/**
 * DADOS DE EXEMPLO no mesmo formato (suposto) da API da Escola Avançada.
 * Usados enquanto não temos a chave da API. Nada aqui é real.
 */
export const cursosMock: EACursoRaw[] = [
  {
    id: 101,
    nome: "Excel do Básico ao Avançado",
    descricao:
      "<p>Aprenda Excel do zero até tabelas dinâmicas, PROCV, gráficos e automações simples. Ideal para quem quer se destacar no mercado de trabalho e organizar a rotina de qualquer empresa.</p><p>Inclui planilhas de exercício e projetos práticos.</p>",
    valor: "197.00",
    capa: "",
    carga_horaria: "40",
    categoria: "Informática",
  },
  {
    id: 102,
    nome: "Marketing Digital na Prática",
    descricao:
      "<p>Domine as redes sociais, anúncios no Instagram e Google, funil de vendas e métricas. Um curso direto ao ponto para pequenos negócios e profissionais autônomos.</p>",
    valor: "247.00",
    capa: "",
    carga_horaria: "60",
    categoria: "Negócios",
  },
  {
    id: 103,
    nome: "Programação Web para Iniciantes",
    descricao:
      "<p>HTML, CSS e JavaScript explicados passo a passo. Ao final você publica o seu primeiro site na internet.</p>",
    valor: "297.00",
    capa: "",
    carga_horaria: "80",
    categoria: "Tecnologia",
  },
  {
    id: 104,
    nome: "Design Gráfico com Canva e Photoshop",
    descricao:
      "<p>Crie artes para redes sociais, logotipos e materiais impressos. Teoria das cores, tipografia e composição com ferramentas que o mercado usa.</p>",
    valor: "167.00",
    capa: "",
    carga_horaria: "35",
    categoria: "Design",
  },
  {
    id: 105,
    nome: "Assistente Administrativo",
    descricao:
      "<p>Rotinas de escritório, atendimento, documentos, arquivo, noções de departamento pessoal e financeiro. Prepare-se para a sua primeira vaga.</p>",
    valor: "147.00",
    capa: "",
    carga_horaria: "45",
    categoria: "Negócios",
  },
  {
    id: 106,
    nome: "Informática Essencial",
    descricao:
      "<p>Windows, internet com segurança, e-mail, Word e noções de Excel e PowerPoint. O primeiro passo para quem está começando.</p>",
    valor: "97.00",
    capa: "",
    carga_horaria: "30",
    categoria: "Informática",
  },
];

function aulasGenericas(prefixo: string): EAAulaRaw[] {
  const modulos = [
    ["Boas-vindas", ["Apresentação do curso", "Como estudar na plataforma"]],
    [`Fundamentos de ${prefixo}`, ["Conceitos iniciais", "Primeiros passos", "Exercício guiado"]],
    ["Aprofundando", ["Técnicas intermediárias", "Estudo de caso", "Erros comuns e como evitar"]],
    ["Projeto final", ["Planejando o projeto", "Executando o projeto", "Encerramento e próximos passos"]],
  ] as const;
  let ordem = 0;
  return modulos.flatMap(([modulo, aulas]) =>
    aulas.map((titulo) => ({ id: `${prefixo}-${++ordem}`, titulo, modulo, ordem })),
  );
}

export const aulasMock: Record<string, EAAulaRaw[]> = {
  "101": aulasGenericas("Excel"),
  "102": aulasGenericas("Marketing"),
  "103": aulasGenericas("Web"),
  "104": aulasGenericas("Design"),
  "105": aulasGenericas("Administração"),
  "106": aulasGenericas("Informática"),
};
