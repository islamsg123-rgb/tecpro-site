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
  cursoId: string;
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
  cursoId: string | null;
  vencimento: string; // AAAA-MM-DD
  /** Link do boleto/fatura no Asaas */
  linkFatura?: string;
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
