/** Usado no navegador e no servidor. */

/** Regras da senha (as mesmas no navegador e no servidor). Devolve o problema ou null. */
export function problemaNaSenha(senha: string, email: string): string | null {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (senha.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  const usuario = email.split("@")[0]?.toLowerCase();
  if (usuario && usuario.length >= 4 && senha.toLowerCase().includes(usuario)) return "A senha não pode conter o seu e-mail.";
  if (/^(12345678|password|senha123|tecpro123)/i.test(senha)) return "Essa senha é muito fácil de adivinhar. Escolha outra.";
  return null;
}
