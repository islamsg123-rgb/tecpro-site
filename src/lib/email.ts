import "server-only";

/**
 * E-mails do próprio site, enviados pelo Resend (resend.com).
 * Sem RESEND_API_KEY nada é enviado: o site só registra que pulou o envio.
 */

const CHAVE = process.env.RESEND_API_KEY;
/** Remetente. Precisa ser de um domínio verificado no Resend (ex.: "Tecpro <contato@tecpromultiensino.com.br>"). */
const REMETENTE = process.env.EMAIL_REMETENTE || "Tecpro Multi Ensino <onboarding@resend.dev>";

export const emailConfigurado = Boolean(CHAVE);

export interface Anexo {
  /** Nome do arquivo, ex.: "certificado.pdf" */
  nome: string;
  /** Conteúdo do arquivo */
  conteudo: Uint8Array;
}

/**
 * Manda um e-mail pelo Resend e devolve o id dele no Resend.
 * `agendarPara` (data ISO): o Resend guarda o e-mail e só entrega nesse horário (dá para cancelar antes).
 */
export async function enviarEmail(e: {
  para: string; assunto: string; html: string; texto: string; cabecalhos?: Record<string, string>; agendarPara?: string; anexos?: Anexo[];
}): Promise<string | null> {
  if (!CHAVE) throw new Error("RESEND_API_KEY não configurada na Vercel: e-mail não enviado");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: REMETENTE, to: [e.para], subject: e.assunto, html: e.html, text: e.texto,
      ...(e.cabecalhos ? { headers: e.cabecalhos } : {}),
      ...(e.agendarPara ? { scheduled_at: e.agendarPara } : {}),
      ...(e.anexos?.length ? { attachments: e.anexos.map((a) => ({ filename: a.nome, content: Buffer.from(a.conteudo).toString("base64") })) } : {}),
    }),
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Resend recusou o e-mail (HTTP ${resp.status}): ${(await resp.text()).slice(0, 300)}`);
  const r = (await resp.json().catch(() => null)) as { id?: string } | null;
  return r?.id ?? null;
}

/** Cancela um e-mail agendado no Resend (que ainda não saiu). */
export async function cancelarEmailAgendado(id: string): Promise<void> {
  if (!CHAVE) return;
  const resp = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}/cancel`, {
    method: "POST", headers: { Authorization: `Bearer ${CHAVE}` }, cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Resend não cancelou o e-mail (HTTP ${resp.status}): ${(await resp.text()).slice(0, 300)}`);
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
    `Para assistir às aulas, entre em ${link} com este mesmo e-mail. No primeiro acesso, clique em "Criar minha senha": você recebe um código neste e-mail e cria a sua senha. Depois é só entrar com e-mail e senha.`,
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
<p style="font-size:15px;line-height:1.6;margin:0 0 24px">Para assistir às aulas, entre na Área do aluno com este mesmo e-mail. No primeiro acesso, clique em <strong>Criar minha senha</strong>: você recebe um código neste e-mail e cria a sua senha. Depois é só entrar com e-mail e senha.</p>
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

/* ---------- Certificado ---------- */

const topo = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7fe;font-family:Arial,Helvetica,sans-serif;color:#011749">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#011749;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">TECPRO <span style="color:#FFA500">Multi Ensino</span></td></tr>`;

const botaoLaranja = (link: string, rotulo: string) =>
  `<a href="${escapar(link)}" style="display:inline-block;background:#FFA500;color:#011749;text-decoration:none;font-weight:bold;padding:15px 32px;border-radius:999px;font-size:17px">${escapar(rotulo)}</a>`;

/** Desenho de um certificado com o nome do aluno (só HTML, funciona em qualquer leitor de e-mail). */
function miniCertificado(nome: string, curso: string, horas: number, selo: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border:3px solid #011749;border-radius:12px;background:#fffdf7"><tr><td style="padding:6px">
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #FFA500;border-radius:8px"><tr><td align="center" style="padding:22px 18px">
<p style="margin:0;font-size:11px;letter-spacing:3px;color:#FFA500;font-weight:bold">CERTIFICADO DE CONCLUSÃO</p>
<p style="margin:12px 0 4px;font-size:12px;color:#64748b">Certificamos que</p>
<p style="margin:0;font-size:22px;font-weight:bold;color:#011749;font-family:Georgia,'Times New Roman',serif">${escapar(nome)}</p>
<p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#475569">concluiu com êxito o curso online<br><strong style="color:#011749;font-size:15px">${escapar(curso)}</strong>${horas ? `<br>Carga horária: ${horas} horas` : ""}</p>
<p style="margin:14px 0 0"><span style="display:inline-block;background:#011749;color:#ffffff;font-size:11px;font-weight:bold;padding:5px 12px;border-radius:999px">${escapar(selo)}</span></p>
</td></tr></table></td></tr></table>`;
}

const rodapeSair = (linkSair: string) =>
  `<p style="max-width:560px;font-size:12px;line-height:1.5;color:#94a3b8;margin:16px auto 0;text-align:center">Você recebeu este e-mail porque concluiu um curso na Tecpro Multi Ensino.<br><a href="${escapar(linkSair)}" style="color:#94a3b8">Não quero mais receber lembretes</a></p>`;

const fim = (extra = "") => `</td></tr></table>${extra}</td></tr></table></body></html>`;

/**
 * Concluiu um curso com certificado pago e não emitiu: parabéns + por que o certificado é importante.
 * Não fala de preço. Técnicas: reconhecimento da conquista, certificado já com o nome da pessoa
 * (sensação de que ele já é dela), o que ela perde sem ele e como é rápido.
 */
export function emailParabensCertificado(d: { nome: string; curso: string; horas: number; link: string; linkSair: string }) {
  const nomeCompleto = d.nome.trim().replace(/\s+/g, " ");
  const primeiro = nomeCompleto.split(" ")[0] || "";
  const assunto = `${primeiro ? `${primeiro}, p` : "P"}arabéns! Seu certificado de ${d.curso} está quase pronto`;
  const beneficios = [
    ["Comprova o que você aprendeu", "no currículo, no LinkedIn e em entrevistas de emprego."],
    ["Faz você se destacar", "na hora em que a empresa compara candidatos parecidos."],
    ["Tem validade fácil de conferir", "com código e QR Code que qualquer empresa confere no nosso site."],
    ["Fica com você para sempre", "em PDF, para imprimir ou mandar quando precisar."],
  ];
  const html = `${topo}
<tr><td style="padding:28px">
<p style="font-size:26px;margin:0 0 6px">🎉</p>
<p style="font-size:20px;font-weight:bold;margin:0 0 12px">Parabéns${primeiro ? `, ${escapar(primeiro)}` : ""}!</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Você concluiu o curso <strong>${escapar(d.curso)}</strong>. Assistiu às aulas, fez as atividades e chegou até o fim. Muita gente começa um curso e para no meio; <strong>você terminou</strong>. Isso mostra dedicação e vontade de crescer.</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 4px">Agora falta só um passo para transformar esse esforço em algo que você pode mostrar para o mundo: <strong>o seu certificado</strong>.</p>
${miniCertificado(nomeCompleto || "Seu nome aqui", d.curso, d.horas, "Falta só emitir")}
<p style="font-size:15px;font-weight:bold;margin:0 0 10px">Com o certificado em mãos, você:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">
${beneficios.map(([t, s]) => `<tr><td width="28" valign="top" style="padding:5px 0;font-size:16px;color:#16a34a">✔</td><td style="padding:5px 0;font-size:14px;line-height:1.5"><strong>${t}</strong> ${s}</td></tr>`).join("\n")}
</table>
<p style="font-size:15px;line-height:1.6;margin:0 0 4px">Sem o certificado, todo o tempo que você dedicou fica sem comprovação. Com ele, o seu esforço vira <strong>oportunidade</strong>.</p>
<p style="margin:24px 0 10px;text-align:center">${botaoLaranja(d.link, "Emitir meu certificado")}</p>
<p style="font-size:13px;line-height:1.5;margin:0 0 22px;color:#64748b;text-align:center">Leva menos de 2 minutos. Você baixa o PDF na hora e recebe uma cópia por e-mail.</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#475569">Tem alguma dúvida? Fale com a gente pelo botão de ajuda no site.</p>
<p style="font-size:13px;color:#64748b;margin:0">Um abraço e parabéns de novo!<br>Equipe Tecpro Multi Ensino</p>
</td></tr>${fim(rodapeSair(d.linkSair))}`;
  const texto = [
    `Parabéns${primeiro ? `, ${primeiro}` : ""}!`, ``,
    `Você concluiu o curso ${d.curso}. Muita gente começa um curso e para no meio; você terminou. Isso mostra dedicação e vontade de crescer.`, ``,
    `Agora falta só um passo: emitir o seu certificado. Com ele você:`,
    ...beneficios.map(([t, s]) => `- ${t} ${s}`), ``,
    `Sem o certificado, o tempo que você dedicou fica sem comprovação. Com ele, o seu esforço vira oportunidade.`, ``,
    `Emitir meu certificado: ${d.link}`, ``,
    `Leva menos de 2 minutos. Você baixa o PDF na hora e recebe uma cópia por e-mail.`, ``,
    `Equipe Tecpro Multi Ensino`, ``,
    `Não quer mais receber lembretes? ${d.linkSair}`,
  ].join("\n");
  return { assunto, html, texto };
}

/** Certificado emitido: vai em PDF anexo, com link permanente para baixar de novo e para validar. */
export function emailCertificadoEmitido(d: {
  nome: string; curso: string; horas: number; codigo: string; emitidoEm: string; linkPdf: string; linkValidar: string;
}) {
  const nomeCompleto = d.nome.trim().replace(/\s+/g, " ");
  const primeiro = nomeCompleto.split(" ")[0] || "";
  const data = new Date(d.emitidoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const assunto = `Seu certificado de ${d.curso} chegou 🎓`;
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:130px">${rotulo}</td><td style="padding:6px 0;font-size:14px;font-weight:bold;color:#011749">${valor}</td></tr>`;
  const html = `${topo}
<tr><td style="padding:28px">
<p style="font-size:26px;margin:0 0 6px">🎓</p>
<p style="font-size:20px;font-weight:bold;margin:0 0 12px">Parabéns${primeiro ? `, ${escapar(primeiro)}` : ""}! Seu certificado está aqui.</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 4px">O seu certificado de <strong>${escapar(d.curso)}</strong> foi emitido. <strong>O PDF está anexado a este e-mail</strong>: guarde esta mensagem, assim ele fica sempre com você.</p>
${miniCertificado(nomeCompleto, d.curso, d.horas, "Emitido ✓")}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f4f7fe;border-radius:12px"><tr><td style="padding:12px 18px">
<table width="100%" cellpadding="0" cellspacing="0">
${linha("Código", `<span style="font-family:'Courier New',monospace">${escapar(d.codigo)}</span>`)}
${linha("Emitido em", data)}
${d.horas ? linha("Carga horária", `${d.horas} horas`) : ""}
</table></td></tr></table>
<p style="margin:0 0 12px;text-align:center">${botaoLaranja(d.linkPdf, "Baixar certificado (PDF)")}</p>
<p style="margin:0 0 24px;text-align:center;font-size:14px"><a href="${escapar(d.linkValidar)}" style="color:#1d4ed8;font-weight:bold">Ver página de validação</a></p>
<p style="font-size:15px;font-weight:bold;margin:0 0 8px">Dica: coloque no LinkedIn</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#475569">No seu perfil, vá em <em>Adicionar seção &gt; Licenças e certificados</em>. Em organização, escreva <strong>Tecpro Multi Ensino</strong>; em código da credencial, <strong>${escapar(d.codigo)}</strong>; e em URL da credencial, cole o link de validação: <span style="word-break:break-all">${escapar(d.linkValidar)}</span></p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#475569">Qualquer empresa pode conferir que o certificado é verdadeiro pelo QR Code ou pelo link de validação.</p>
<p style="font-size:13px;color:#64748b;margin:0">Sucesso na sua caminhada!<br>Equipe Tecpro Multi Ensino</p>
</td></tr>${fim()}`;
  const texto = [
    `Parabéns${primeiro ? `, ${primeiro}` : ""}! Seu certificado está aqui.`, ``,
    `O seu certificado de ${d.curso} foi emitido. O PDF está anexado a este e-mail: guarde esta mensagem.`, ``,
    `Código: ${d.codigo}`, `Emitido em: ${data}`, ...(d.horas ? [`Carga horária: ${d.horas} horas`] : []), ``,
    `Baixar certificado (PDF): ${d.linkPdf}`,
    `Página de validação: ${d.linkValidar}`, ``,
    `Dica: no LinkedIn, vá em Licenças e certificados, use a organização Tecpro Multi Ensino, o código ${d.codigo} e o link de validação acima.`, ``,
    `Equipe Tecpro Multi Ensino`,
  ].join("\n");
  return { assunto, html, texto };
}
