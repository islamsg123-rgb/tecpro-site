import "server-only";

/**
 * E-mails do próprio site, enviados pelo Resend (resend.com).
 * Sem RESEND_API_KEY nada é enviado: o site só registra que pulou o envio.
 */

const CHAVE = process.env.RESEND_API_KEY;
/** Remetente. Precisa ser de um domínio verificado no Resend (ex.: "Tecpro <contato@tecpromultiensino.com.br>"). */
const REMETENTE = process.env.EMAIL_REMETENTE || "Tecpro Multi Ensino <onboarding@resend.dev>";

export const emailConfigurado = Boolean(CHAVE);

export async function enviarEmail(e: { para: string; assunto: string; html: string; texto: string; cabecalhos?: Record<string, string> }): Promise<void> {
  if (!CHAVE) throw new Error("RESEND_API_KEY não configurada na Vercel: e-mail não enviado");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMETENTE, to: [e.para], subject: e.assunto, html: e.html, text: e.texto, ...(e.cabecalhos ? { headers: e.cabecalhos } : {}) }),
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Resend recusou o e-mail (HTTP ${resp.status}): ${(await resp.text()).slice(0, 300)}`);
}

const escapar = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Boas-vindas depois da compra. Não leva senha: o aluno entra no site com o próprio e-mail
 * (link mágico), então nada sensível viaja no e-mail.
 */
export function emailBoasVindas(nome: string, curso: string, siteUrl: string, pago = true) {
  const primeiro = nome.trim().split(/\s+/)[0] || "aluno";
  const link = `${siteUrl.replace(/\/+$/, "")}/entrar`;
  const assunto = `Seu acesso ao curso ${curso} está liberado`;
  const abertura = pago ? "Seu pagamento foi confirmado e o curso" : "Sua matrícula foi feita e o curso";
  const texto = [
    `Olá, ${primeiro}!`,
    ``,
    `${abertura} ${curso} já está liberado.`,
    ``,
    `Para assistir às aulas, entre em ${link} com este mesmo e-mail. Você vai receber um link de acesso, sem precisar de senha.`,
    ``,
    `Bons estudos!`,
    `Tecpro Multi Ensino`,
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7fe;font-family:Arial,Helvetica,sans-serif;color:#011749">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#011749;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">TECPRO <span style="color:#FFA500">Multi Ensino</span></td></tr>
<tr><td style="padding:28px">
<p style="font-size:18px;font-weight:bold;margin:0 0 12px">Olá, ${escapar(primeiro)}!</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${abertura} <strong>${escapar(curso)}</strong> já está liberado.</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 24px">Para assistir às aulas, entre na Área do aluno com este mesmo e-mail. Você recebe um link de acesso, sem precisar de senha.</p>
<p style="margin:0 0 24px"><a href="${escapar(link)}" style="display:inline-block;background:#FFA500;color:#011749;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">Acessar meu curso</a></p>
<p style="font-size:13px;color:#64748b;margin:0">Bons estudos!<br>Tecpro Multi Ensino</p>
</td></tr></table></td></tr></table></body></html>`;
  return { assunto, html, texto };
}

/**
 * Link de acesso à conta (substitui o e-mail do Supabase). Funciona em qualquer navegador e traz
 * também um código para digitar no site, caso o link não abra.
 */
export function emailLinkAcesso(link: string, codigo: string, paraSenha: boolean) {
  const assunto = paraSenha ? "Crie sua senha na Tecpro Multi Ensino" : "Seu link de acesso à Tecpro Multi Ensino";
  const acao = paraSenha ? "Criar minha senha" : "Entrar na minha conta";
  const intro = paraSenha
    ? "Recebemos um pedido para criar ou trocar a senha da sua conta."
    : "Use o botão abaixo para entrar na Área do aluno.";
  const texto = [
    `Olá!`,
    ``,
    intro,
    ``,
    `${acao}: ${link}`,
    ...(codigo ? [``, `Ou digite este código na tela de entrada do site: ${codigo}`] : []),
    ``,
    `O link e o código valem por 1 hora e só podem ser usados uma vez. Pode abrir em qualquer aparelho ou navegador.`,
    `Se você não pediu este acesso, ignore este e-mail.`,
    ``,
    `Tecpro Multi Ensino`,
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7fe;font-family:Arial,Helvetica,sans-serif;color:#011749">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#011749;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">TECPRO <span style="color:#FFA500">Multi Ensino</span></td></tr>
<tr><td style="padding:28px">
<p style="font-size:18px;font-weight:bold;margin:0 0 12px">Olá!</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 24px">${escapar(intro)}</p>
<p style="margin:0 0 24px"><a href="${escapar(link)}" style="display:inline-block;background:#FFA500;color:#011749;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">${acao}</a></p>
${codigo ? `<p style="font-size:14px;line-height:1.6;margin:0 0 8px;color:#475569">Se o botão não abrir, digite este código na tela de entrada do site:</p>
<p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:0 0 24px;color:#011749">${escapar(codigo)}</p>` : ""}
<p style="font-size:13px;line-height:1.6;color:#64748b;margin:0 0 8px">O link e o código valem por 1 hora e só podem ser usados uma vez. Pode abrir em qualquer aparelho ou navegador.</p>
<p style="font-size:13px;line-height:1.6;color:#64748b;margin:0">Se você não pediu este acesso, ignore este e-mail.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { assunto, html, texto };
}

/**
 * Lembrete para quem parou de estudar (1º, 2º ou 3º). Texto motivacional, progresso do curso
 * e botão para continuar. No fim, link para não receber mais lembretes (LGPD).
 */
export function emailLembrete(d: {
  nome: string; curso: string; pct: number; feitas: number; total: number; dias: number; etapa: number;
  linkContinuar: string; linkSair: string;
}) {
  const primeiro = d.nome.trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const faltam = Math.max(d.total - d.feitas, 0);
  const faltamTxt = `${faltam} ${faltam === 1 ? "aula" : "aulas"}`;
  const variacoes = [
    {
      assunto: `${primeiro ? `${primeiro}, s` : "S"}eu curso de ${d.curso} está te esperando`,
      paragrafos: [
        `Faz ${d.dias} dias que você não estuda <strong>${escapar(d.curso)}</strong>. Acontece com todo mundo: a rotina aperta e o curso fica para depois.`,
        `Mas você já começou, e isso é o mais difícil! Que tal separar só 15 minutinhos hoje para assistir à próxima aula? Pequenos passos todo dia levam você até o fim.`,
      ],
    },
    {
      assunto: `Você já fez ${d.pct}% de ${d.curso}. Bora continuar?`,
      paragrafos: [
        `Já faz ${d.dias} dias desde a sua última aula de <strong>${escapar(d.curso)}</strong>, e o que você aprendeu até aqui continua valendo.`,
        `Quem termina um curso sai na frente: tem mais confiança, mais conhecimento para mostrar e mais chances no mercado de trabalho. Faltam ${faltamTxt}, e você consegue!`,
      ],
    },
    {
      assunto: `${primeiro ? `${primeiro}, n` : "N"}ão desista: faltam ${faltamTxt} para terminar ${d.curso}`,
      paragrafos: [
        `Faz ${d.dias} dias que você não estuda <strong>${escapar(d.curso)}</strong>. Sabemos que nem sempre é fácil manter o ritmo, mas não deixe o que você já conquistou se perder.`,
        `Lembra por que você começou? Esse objetivo continua aí. Volte hoje, mesmo que seja por uma aula só: o seu progresso está salvo e você continua exatamente de onde parou.`,
      ],
    },
  ];
  const v = variacoes[Math.min(Math.max(d.etapa, 1), 3) - 1];
  const semTags = (t: string) => t.replace(/<[^>]+>/g, "");
  const texto = [
    ola, ``,
    ...v.paragrafos.map(semTags).flatMap((p) => [p, ``]),
    `Seu progresso: ${d.pct}% (${d.feitas} de ${d.total} aulas).`, ``,
    `Continuar de onde parei: ${d.linkContinuar}`, ``,
    `Bons estudos!`, `Equipe Tecpro Multi Ensino`, ``,
    `Não quer mais receber lembretes de estudo? ${d.linkSair}`,
  ].join("\n");
  const barra = Math.min(Math.max(d.pct, 3), 100);
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7fe;font-family:Arial,Helvetica,sans-serif;color:#011749">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#011749;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">TECPRO <span style="color:#FFA500">Multi Ensino</span></td></tr>
<tr><td style="padding:28px">
<p style="font-size:18px;font-weight:bold;margin:0 0 12px">${escapar(ola)}</p>
${v.paragrafos.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${p}</p>`).join("\n")}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;background:#f4f7fe;border-radius:12px"><tr><td style="padding:16px 18px">
<p style="font-size:13px;color:#475569;margin:0 0 8px">Seu progresso em <strong style="color:#011749">${escapar(d.curso)}</strong></p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#dbe3f4;border-radius:999px"><tr><td width="${barra}%" style="background:#FFA500;border-radius:999px;height:12px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table>
<p style="font-size:14px;margin:8px 0 0"><strong>${d.pct}% concluído</strong> <span style="color:#64748b">· ${d.feitas} de ${d.total} aulas</span></p>
</td></tr></table>
<p style="margin:24px 0"><a href="${escapar(d.linkContinuar)}" style="display:inline-block;background:#FFA500;color:#011749;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px;font-size:16px">Continuar de onde parei</a></p>
<p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#475569">Dica: estudar um pouco todo dia, no mesmo horário, ajuda a criar o hábito. Você pode assistir pelo celular, onde estiver.</p>
<p style="font-size:13px;color:#64748b;margin:0">Bons estudos!<br>Equipe Tecpro Multi Ensino</p>
</td></tr></table>
<p style="max-width:520px;font-size:12px;line-height:1.5;color:#94a3b8;margin:16px auto 0;text-align:center">Você recebeu este e-mail porque está matriculado em um curso da Tecpro Multi Ensino.<br><a href="${escapar(d.linkSair)}" style="color:#94a3b8">Não quero mais receber lembretes de estudo</a></p>
</td></tr></table></body></html>`;
  return { assunto: v.assunto, html, texto };
}

/** Moldura comum dos e-mails de lembrete (topo azul, botão laranja, link para sair da lista no rodapé). */
function moldura(d: { ola: string; paragrafos: string[]; meio?: string; botao: string; link: string; dica: string; linkSair: string; motivo: string }) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7fe;font-family:Arial,Helvetica,sans-serif;color:#011749">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#011749;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">TECPRO <span style="color:#FFA500">Multi Ensino</span></td></tr>
<tr><td style="padding:28px">
<p style="font-size:18px;font-weight:bold;margin:0 0 12px">${escapar(d.ola)}</p>
${d.paragrafos.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${p}</p>`).join("\n")}
${d.meio ?? ""}
<p style="margin:24px 0"><a href="${escapar(d.link)}" style="display:inline-block;background:#FFA500;color:#011749;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px;font-size:16px">${escapar(d.botao)}</a></p>
<p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#475569">${d.dica}</p>
<p style="font-size:13px;color:#64748b;margin:0">Bons estudos!<br>Equipe Tecpro Multi Ensino</p>
</td></tr></table>
<p style="max-width:520px;font-size:12px;line-height:1.5;color:#94a3b8;margin:16px auto 0;text-align:center">${escapar(d.motivo)}<br><a href="${escapar(d.linkSair)}" style="color:#94a3b8">Não quero mais receber lembretes de estudo</a></p>
</td></tr></table></body></html>`;
}

const semTagsTexto = (t: string) => t.replace(/<[^>]+>/g, "");

function textoSimples(ola: string, paragrafos: string[], botao: string, link: string, linkSair: string) {
  return [ola, ``, ...paragrafos.map(semTagsTexto).flatMap((p) => [p, ``]), `${botao}: ${link}`, ``, `Bons estudos!`, `Equipe Tecpro Multi Ensino`, ``,
    `Não quer mais receber lembretes de estudo? ${linkSair}`].join("\n");
}

/** Matriculado que ainda não abriu nenhuma aula do curso (1º, 2º ou 3º lembrete). */
export function emailNuncaComecou(d: { nome: string; curso: string; dias: number; etapa: number; link: string; linkSair: string }) {
  const primeiro = d.nome.trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const c = `<strong>${escapar(d.curso)}</strong>`;
  const variacoes = [
    {
      assunto: `${primeiro ? `${primeiro}, s` : "S"}eu curso de ${d.curso} já está liberado`,
      paragrafos: [
        `Seu curso ${c} já está liberado e esperando por você! A primeira aula é o passo mais importante.`,
        `As aulas são em vídeo, curtas e você assiste quando e onde quiser, até pelo celular. Seu progresso fica salvo e você continua de onde parou.`,
      ],
    },
    {
      assunto: `A primeira aula de ${d.curso} está te esperando`,
      paragrafos: [
        `Faz ${d.dias} dias que você se matriculou em ${c}, mas ainda não assistiu à primeira aula.`,
        `Que tal começar hoje? Separe só 15 minutinhos: em poucos dias você já vai perceber a diferença no que sabe.`,
      ],
    },
    {
      assunto: `${primeiro ? `${primeiro}, a` : "A"}inda dá tempo de começar ${d.curso}`,
      paragrafos: [
        `Você deu o primeiro passo quando se matriculou em ${c}. Agora falta só começar!`,
        `Quem estuda um pouco todo dia termina o curso sem perceber, e sai com mais conhecimento e mais chances no mercado de trabalho. Seu acesso continua liberado.`,
      ],
    },
  ];
  const v = variacoes[Math.min(Math.max(d.etapa, 1), 3) - 1];
  const botao = "Começar meu curso";
  return {
    assunto: v.assunto,
    texto: textoSimples(ola, v.paragrafos, botao, d.link, d.linkSair),
    html: moldura({
      ola, paragrafos: v.paragrafos, botao, link: d.link, linkSair: d.linkSair,
      dica: "Para entrar, use este mesmo e-mail. Se não lembrar a senha, o site manda um link de acesso na hora.",
      motivo: "Você recebeu este e-mail porque está matriculado em um curso da Tecpro Multi Ensino.",
    }),
  };
}
