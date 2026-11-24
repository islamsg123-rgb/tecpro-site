import "server-only";

/**
 * E-mails do próprio site, enviados pelo Resend (resend.com).
 * Sem RESEND_API_KEY nada é enviado: o site só registra que pulou o envio.
 */

const CHAVE = process.env.RESEND_API_KEY;
/** Remetente. Precisa ser de um domínio verificado no Resend (ex.: "Tecpro <contato@tecpromultiensino.com.br>"). */
const REMETENTE = process.env.EMAIL_REMETENTE || "Tecpro Multi Ensino <onboarding@resend.dev>";

export const emailConfigurado = Boolean(CHAVE);

export async function enviarEmail(e: { para: string; assunto: string; html: string; texto: string }): Promise<void> {
  if (!CHAVE) throw new Error("RESEND_API_KEY não configurada na Vercel: e-mail não enviado");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMETENTE, to: [e.para], subject: e.assunto, html: e.html, text: e.texto }),
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
