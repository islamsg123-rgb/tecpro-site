import "server-only";
import { obterConfigLoja } from "./dados";
import { TIPOS_AJUDA, type MensagemAjuda } from "./dados/mensagens";
import { getCursoPorSlug } from "./cursos";
import { formatarPreco, precoDoCurso } from "./formatar";

/**
 * Pedido pronto para o Claude (claude.ai) escrever a resposta de uma mensagem do botão de ajuda.
 * Gratuito: o painel só monta o texto; a equipe abre o Claude na própria conta e cola.
 */

const INSTRUCOES = `Você vai ajudar a equipe da Tecpro Multi Ensino, uma escola de cursos online (cursos livres e profissionalizantes, com certificado), a responder mensagens que alunos e visitantes enviam pelo botão de ajuda do site.

Escreva a resposta que a equipe vai colar no Gmail e enviar para a pessoa:
- Em português do Brasil, tom cordial, simples e direto, como um atendente atencioso. Frases curtas, sem jargão técnico.
- Comece com "Olá, <primeiro nome>!" (ou só "Olá!" se não houver nome). Não escreva assunto nem assinatura: a assinatura já está no e-mail.
- Responda ao que a pessoa perguntou usando os dados da escola e do curso informados abaixo. Nunca invente preço, prazo, conteúdo de aula, link ou política que não esteja nos dados. Se faltar informação, diga que a equipe vai verificar e retornar, ou peça o detalhe que falta.
- Para problemas técnicos (vídeo que não abre, erro, não consegue entrar), dê de 2 a 4 passos práticos (atualizar a página, testar outro navegador ou o celular, conferir a internet, entrar pelo link/código enviado ao e-mail e olhar o spam) e diga que a equipe já está verificando.
- Só fale do valor do certificado se a pessoa perguntar sobre certificado.
- Não prometa reembolso, desconto ou prazo de solução.
- Nunca indique WhatsApp ou telefone da escola: o atendimento é só por e-mail e pelo botão de ajuda do site.
- Responda só com o texto do e-mail, de 60 a 160 palavras.`;

function dadosDaEscola(loja: Awaited<ReturnType<typeof obterConfigLoja>>) {
  return [
    `Acesso aos cursos: ${loja.mesesDeAcesso ? `${loja.mesesDeAcesso} meses` : "vitalício"}. Estudo 100% online, no ritmo do aluno, pelo celular ou computador.`,
    `Entrar no site: em "Área do aluno", com o e-mail usado na matrícula (recebe um link ou código no e-mail) ou com e-mail e senha.`,
    `Cursos pagos: certificado incluso ao concluir. Pagamento por Pix, boleto ou cartão.`,
    `Cursos gratuitos: a matrícula é grátis; ao concluir, o certificado pode ser emitido por ${formatarPreco(loja.precoCertIndividual)} (ou pacotes: 3 por ${formatarPreco(loja.precoCertEssencial)}, 5 por ${formatarPreco(loja.precoCertProfissional)}).`,
    `Para concluir uma aula: assistir pelo menos 80% do vídeo e acertar a prova da aula.`,
    `Certificados podem ser validados em /validar. Correção de nome no certificado só pelo suporte.`,
    `Contato da escola: só por e-mail (${loja.emailContato || "contato@tecpromultiensino.com.br"}) e pelo botão de ajuda do site. A escola não atende por WhatsApp nem telefone.`,
  ].filter(Boolean).join("\n");
}

async function dadosDoCurso(pagina: string | null): Promise<string | null> {
  const m = pagina?.match(/^\/(?:minha-conta\/cursos|cursos|checkout)\/([^/?#]+)/);
  if (!m) return null;
  const curso = await getCursoPorSlug(decodeURIComponent(m[1])).catch(() => null);
  if (!curso) return null;
  return [
    `Curso: ${curso.nome} (${curso.categoria})`,
    `Preço: ${precoDoCurso(curso)}${curso.gratuito ? " (curso gratuito)" : ""}`,
    curso.cargaHoraria ? `Carga horária: ${curso.cargaHoraria} horas` : "",
    `Descrição: ${curso.descricao.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200)}`,
  ].filter(Boolean).join("\n");
}

export async function montarPedidoClaude(m: MensagemAjuda): Promise<string> {
  const loja = await obterConfigLoja();
  const curso = await dadosDoCurso(m.pagina);
  return [
    INSTRUCOES,
    "",
    `<dados_da_escola>\n${dadosDaEscola(loja)}\n</dados_da_escola>`,
    curso ? `<curso_da_pagina>\n${curso}\n</curso_da_pagina>` : "",
    `<mensagem>`,
    `Assunto escolhido: ${TIPOS_AJUDA[m.tipo]}`,
    `Enviada de: ${m.origem === "aluno" ? "Área do aluno (já é aluno)" : "Loja virtual (visitante ou aluno sem estar na área do aluno)"}`,
    `Página: ${m.pagina ?? "não informada"}`,
    m.aulaTitulo ? `Aula: ${m.aulaTitulo}` : "",
    `Nome: ${m.nome ?? "não informado"}`,
    `Texto da pessoa: ${m.mensagem}`,
    `</mensagem>`,
  ].filter(Boolean).join("\n");
}
