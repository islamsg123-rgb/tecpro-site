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

/**
 * Senha fácil de ditar ou digitar no celular (ex.: "Bavi-Moku-4821"): duas sílabas duplas e 4 números,
 * sem letras parecidas (l/I, o/0). Usa o sorteio seguro do navegador/servidor.
 */
export function gerarSenhaFacil(): string {
  const consoantes = "bcdfgjkmnprstvz";
  const vogais = "aeiu";
  const n = new Uint32Array(9);
  globalThis.crypto.getRandomValues(n);
  const silaba = (i: number) => consoantes[n[i] % consoantes.length] + vogais[n[i + 1] % vogais.length];
  const palavra = (i: number) => {
    const p = silaba(i) + silaba(i + 2);
    return p[0].toUpperCase() + p.slice(1);
  };
  const numeros = String(1000 + (n[8] % 9000));
  return `${palavra(0)}-${palavra(4)}-${numeros}`;
}
