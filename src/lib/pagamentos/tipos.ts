/** O que está sendo pago: a matrícula num curso ou o certificado de um curso já feito. */
export type Produto =
  | { tipo: "curso"; cursoId: string }
  | { tipo: "certificado"; cursoId: string; email: string; /** Pacote: quantos certificados (padrão 1) */ quantidade?: number };

/** Texto guardado no Asaas (externalReference) para saber o que foi pago. */
export function referenciaProduto(p: Produto): string {
  if (p.tipo === "curso") return `curso:${p.cursoId}`;
  // Pacote de certificados: guarda a quantidade junto (ex.: "certpacote:3:69:aluno@email.com").
  if ((p.quantidade ?? 1) > 1) return `certpacote:${p.quantidade}:${p.cursoId}:${p.email}`;
  return `certificado:${p.cursoId}:${p.email}`;
}

export function produtoDaReferencia(ref: unknown): Produto | null {
  if (typeof ref !== "string") return null;
  if (ref.startsWith("certpacote:")) {
    const [, qtd, cursoId, ...resto] = ref.split(":");
    const quantidade = Number(qtd);
    if (cursoId && resto.length && Number.isInteger(quantidade) && quantidade > 0) {
      return { tipo: "certificado", cursoId, email: resto.join(":"), quantidade };
    }
    return null;
  }
  const [tipo, cursoId, ...resto] = ref.split(":");
  if (tipo === "curso" && cursoId) return { tipo, cursoId };
  if (tipo === "certificado" && cursoId && resto.length) return { tipo, cursoId, email: resto.join(":") };
  return null;
}

export type FormaPagamento = "PIX" | "BOLETO" | "CREDIT_CARD";

/** Situação simplificada que o site mostra ao aluno. */
export type Situacao = "aguardando" | "pago" | "vencido" | "estornado";

export interface Comprador {
  nome: string;
  email: string;
  cpf: string; // só dígitos
  telefone: string; // só dígitos
}

export interface DadosCartao {
  nomeNoCartao: string;
  numero: string; // só dígitos
  mesValidade: string;
  anoValidade: string;
  cvv: string;
  cep: string;
  numeroEndereco: string;
}

export interface NovaCobranca {
  produto: Produto;
  descricao: string;
  valorCentavos: number;
  forma: FormaPagamento;
  comprador: Comprador;
  parcelas?: number;
  cartao?: DadosCartao;
  /** Mercado Pago: o navegador troca o cartão por um token; o número nunca chega ao servidor. */
  cartaoMp?: CartaoMercadoPago;
  /** Mercado Pago: o boleto exige endereço completo (montado pelo CEP). */
  endereco?: Endereco;
  ipComprador?: string;
  /** Por onde a pessoa chegou ao site (Instagram, Google...), para o relatório "De onde veio a venda" */
  origem?: import("../origem").Origem | null;
}

export interface CartaoMercadoPago {
  token: string;
  /** payment_method_id do Mercado Pago (ex.: "visa", "master") */
  bandeira: string;
  /** issuer_id (banco emissor), quando o Mercado Pago informa */
  emissor?: string;
}

export interface Endereco {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/** Onde os pagamentos são processados. */
export type Gateway = "mercadopago" | "asaas";

export interface Cobranca {
  id: string;
  forma: FormaPagamento;
  situacao: Situacao;
  valorCentavos: number;
  produto: Produto | null;
  vencimento: string; // AAAA-MM-DD
  /** Link do boleto/fatura no Asaas */
  linkFatura?: string;
  descricao?: string;
  criadoEm?: string; // AAAA-MM-DD ou data/hora ISO
  /** Nome do cliente, quando disponível (o Asaas só manda o código do cliente na lista) */
  cliente?: string;
  /** E-mail do cliente, quando disponível */
  clienteEmail?: string;
  clienteTelefone?: string;
  /** Código do cliente no Asaas */
  clienteId?: string;
  /** Data em que o dinheiro foi pago (AAAA-MM-DD) */
  pagoEm?: string;
  /** Valor que fica para a Tecpro depois das taxas do Asaas, em centavos */
  valorLiquidoCentavos?: number;
  /** Parcela (ex.: 2 de 12) quando o cartão é parcelado */
  parcela?: number;
  /** Dados do comprador quando vêm junto com o pagamento (Mercado Pago) */
  comprador?: Comprador;
  /** Detalhe técnico da situação (ex.: cartão "em análise") */
  detalheSituacao?: string;
}

export interface DadosPix {
  imagemBase64: string; // PNG em base64 (sem prefixo)
  copiaECola: string;
  expiraEm?: string;
}

export interface DadosBoleto {
  linhaDigitavel: string;
  linkPdf: string;
}

/** Erro com mensagem que pode ser mostrada ao comprador. */
export class ErroPagamento extends Error {}
