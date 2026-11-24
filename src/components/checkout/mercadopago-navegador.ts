"use client";

/**
 * Proteção do cartão no navegador com o SDK oficial do Mercado Pago (MercadoPago.js v2).
 * Os dados do cartão vão direto do navegador para o Mercado Pago, que devolve um "token" de uso único.
 * O nosso servidor só recebe esse token, nunca o número do cartão.
 */

interface SdkMercadoPago {
  getPaymentMethods(p: { bin: string }): Promise<{ results?: { id: string; issuer?: { id?: number | string } }[] }>;
  getInstallments(p: { amount: string; bin: string; paymentTypeId?: string }): Promise<{ payer_costs?: { installments: number }[] }[]>;
  createCardToken(p: {
    cardNumber: string; cardholderName: string; cardExpirationMonth: string; cardExpirationYear: string;
    securityCode: string; identificationType: string; identificationNumber: string;
  }): Promise<{ id: string }>;
}

declare global {
  interface Window {
    MercadoPago?: new (chave: string, opcoes?: { locale?: string }) => SdkMercadoPago;
  }
}

let carregando: Promise<void> | null = null;

function carregarSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  carregando ??= new Promise<void>((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => {
      carregando = null;
      falha(new Error("sdk"));
    };
    document.head.appendChild(s);
  });
  return carregando;
}

/** Já começa a carregar quando o aluno escolhe "Cartão", para o clique em "Pagar" ser rápido. */
export function preCarregarSdk() {
  carregarSdk().catch(() => {});
}

function bandeiraPeloNumero(n: string): { id: string; issuer?: { id?: number | string } } | null {
  if (/^4/.test(n)) return { id: "visa" };
  if (/^(5[1-5]|2[2-7])/.test(n)) return { id: "master" };
  if (/^3[47]/.test(n)) return { id: "amex" };
  if (/^(606282|3841)/.test(n)) return { id: "hipercard" };
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(n)) return { id: "elo" };
  return null;
}

export interface CartaoDigitado {
  numero: string; nome: string; mes: string; ano: string; cvv: string; cpf: string;
  /** Valor da compra em centavos e parcelas escolhidas, para conferir se o Mercado Pago aceita esse parcelamento. */
  valorCentavos: number; parcelas: number;
}

export async function tokenizarCartao(chavePublica: string, c: CartaoDigitado): Promise<{ token: string; bandeira: string; emissor?: string }> {
  try {
    await carregarSdk();
  } catch {
    throw new Error("Não conseguimos carregar o pagamento seguro. Confira sua internet e tente de novo.");
  }
  const mp = new window.MercadoPago!(chavePublica, { locale: "pt-BR" });
  const metodos = await mp.getPaymentMethods({ bin: c.numero.slice(0, 8) }).catch(() => null);
  // Se o Mercado Pago não reconhecer o início do número, deduz a bandeira pelos primeiros dígitos.
  const metodo = metodos?.results?.[0] ?? bandeiraPeloNumero(c.numero);
  if (!metodo) throw new Error("Não reconhecemos este cartão. Confira o número ou use outro cartão.");
  if (c.parcelas > 1) {
    // Confere quantas parcelas o Mercado Pago libera para este cartão e valor (depende da configuração da conta).
    const opcoes = await mp
      .getInstallments({ amount: (c.valorCentavos / 100).toFixed(2), bin: c.numero.slice(0, 8), paymentTypeId: "credit_card" })
      .catch(() => null);
    const permitidas = opcoes?.[0]?.payer_costs?.map((p) => p.installments) ?? [];
    if (permitidas.length && !permitidas.includes(c.parcelas)) {
      const max = Math.max(...permitidas);
      throw new Error(
        max <= 1
          ? "No momento este cartão só pode ser usado à vista. Escolha \"À vista\" ou pague com Pix."
          : `Este cartão aceita no máximo ${max}x. Escolha um parcelamento menor.`,
      );
    }
  }
  const ano = c.ano.length === 2 ? `20${c.ano}` : c.ano;
  try {
    const { id } = await mp.createCardToken({
      cardNumber: c.numero,
      cardholderName: c.nome,
      cardExpirationMonth: c.mes.padStart(2, "0"),
      cardExpirationYear: ano,
      securityCode: c.cvv,
      identificationType: "CPF",
      identificationNumber: c.cpf,
    });
    return { token: id, bandeira: metodo.id, emissor: metodo.issuer?.id != null ? String(metodo.issuer.id) : undefined };
  } catch {
    throw new Error("Confira os dados do cartão (número, validade e código de segurança).");
  }
}
