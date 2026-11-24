import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { obterConfigLoja } from "./dados";
import { TIPOS_AJUDA, type MensagemAjuda } from "./dados/mensagens";
import { getCursoPorSlug } from "./cursos";
import { formatarPreco, precoDoCurso } from "./formatar";

/**
 * Resposta sugerida por IA (Claude) para uma mensagem do botão de ajuda.
 * Só é gerada quando alguém clica em "Sugerir resposta com IA" no painel.
 * Sem ANTHROPIC_API_KEY na Vercel, o botão avisa que a IA não está ligada.
 */

export const iaConfigurada = Boolean(process.env.ANTHROPIC_API_KEY);

const MODELO = "claude-opus-5-5";

const INSTRUCOES = `Você ajuda a equipe da Tecpro Multi Ensino, uma escola de cursos online (cursos livres e profissionalizantes, com certificado), a responder mensagens que alunos e visitantes enviam pelo botão de ajuda do site.

Escreva a resposta que a equipe vai colar no Gmail e enviar para a pessoa:
- Em português do Brasil, tom cordial, simples e direto, como um atendente atencioso. Frases curtas, sem jargão técnico.
- Comece com "Olá, <primeiro nome>!" (ou só "Olá!" se não houver nome). Não escreva assunto nem assinatura: a assinatura já está no e-mail.
- Responda ao que a pessoa perguntou usando os dados da escola e do curso informados abaixo. Nunca invente preço, prazo, conteúdo de aula, link ou política que não esteja nos dados. Se faltar informação, diga que a equipe vai verificar e retornar, ou peça o detalhe que falta.
- Para problemas técnicos (vídeo que não abre, erro, não consegue entrar), dê de 2 a 4 passos práticos (atualizar a página, testar outro navegador ou o celular, conferir a internet, entrar pelo link/código enviado ao e-mail e olhar o spam) e diga que a equipe já está verificando.
- Só fale do valor do certificado se a pessoa perguntar sobre certificado.
- Não prometa reembolso, desconto ou prazo de solução.
- Responda só com o texto do e-mail, de 60 a 160 palavras.`;

function dadosDaEscola(loja: Awaited<ReturnType<typeof obterConfigLoja>>) {
  return [
    `Acesso aos cursos: ${loja.mesesDeAcesso ? `${loja.mesesDeAcesso} meses` : "vitalício"}. Estudo 100% online, no ritmo do aluno, pelo celular ou computador.`,
    `Entrar no site: em "Área do aluno", com o e-mail usado na matrícula (recebe um link ou código no e-mail) ou com e-mail e senha.`,
    `Cursos pagos: certificado incluso ao concluir. Pagamento por Pix, boleto ou cartão.`,
    `Cursos gratuitos: a matrícula é grátis; ao concluir, o certificado pode ser emitido por ${formatarPreco(loja.precoCertIndividual)} (ou pacotes: 3 por ${formatarPreco(loja.precoCertEssencial)}, 5 por ${formatarPreco(loja.precoCertProfissional)}).`,
    `Para concluir uma aula: assistir pelo menos 80% do vídeo e acertar a prova da aula.`,
    `Certificados podem ser validados em /validar. Correção de nome no certificado só pelo suporte.`,
    loja.whatsapp ? `WhatsApp da escola: ${loja.whatsapp}.` : "",
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
    `Descrição: ${curso.descricao.slice(0, 1200)}`,
  ].filter(Boolean).join("\n");
}

export async function sugerirRespostaIA(m: MensagemAjuda): Promise<string> {
  const loja = await obterConfigLoja();
  const curso = await dadosDoCurso(m.pagina);
  const contexto = [
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

  const client = new Anthropic();
  const resposta = await client.beta.messages.create({
    model: MODELO,
    max_tokens: 4000,
    output_config: { effort: "low" },
    // Se o modelo recusar por engano, a própria API tenta de novo em outro modelo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: INSTRUCOES,
    messages: [{ role: "user", content: contexto }],
  });
  if (resposta.stop_reason === "refusal") throw new Error("A IA não quis responder esta mensagem.");
  const texto = resposta.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  if (!texto) throw new Error("A IA não devolveu texto.");
  return texto;
}
