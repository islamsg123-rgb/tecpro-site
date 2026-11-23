/** O que está sendo pago: a matrícula num curso ou o certificado de um curso já feito. */
export type Produto =
  | { tipo: "curso"; cursoId: string }
  | { tipo: "certificado"; cursoId: string; email: string };

/** Texto guardado no Asaas (externalReference) para saber o que foi pago. */
export function referenciaProduto(p: Produto): string {
  return p.tipo === "curso" ? `curso:${p.cursoId}` : `certificado:${p.cursoId}:${p.email}`;
}

export function produtoDaReferencia(ref: unknown): Produto | null {
  if (typeof ref !== "string") return null;
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
  ipComprador?: string;
}

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
