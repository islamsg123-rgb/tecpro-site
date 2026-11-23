/** Validações usadas no navegador (para avisar rápido) e no servidor (para garantir). */

export const soDigitos = (v: string) => v.replace(/\D/g, "");

export function cpfValido(valor: string): boolean {
  const cpf = soDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

export const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const telefoneValido = (v: string) => {
  const d = soDigitos(v);
  return d.length === 10 || d.length === 11;
};

/** Algoritmo de Luhn: pega números de cartão digitados errado. */
export function cartaoValido(numero: string): boolean {
  const d = soDigitos(numero);
  if (d.length < 13 || d.length > 19) return false;
  let soma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
  }
  return soma % 10 === 0;
}

export function validadeValida(mes: string, ano: string): boolean {
  const m = Number(mes);
  let a = Number(ano);
  if (!m || m > 12 || !a) return false;
  if (a < 100) a += 2000;
  const fim = new Date(a, m, 1); // primeiro dia do mês seguinte
  return fim > new Date();
}

export const cepValido = (v: string) => soDigitos(v).length === 8;

export function mascaraCpf(v: string) {
  return soDigitos(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export function mascaraTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
export function mascaraCartao(v: string) {
  return soDigitos(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}
export function mascaraCep(v: string) {
  return soDigitos(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}
