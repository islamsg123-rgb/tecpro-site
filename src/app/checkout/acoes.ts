"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCursos } from "@/lib/cursos";
import { opcoesParcelas } from "@/lib/config-loja";
import { criarCobranca } from "@/lib/pagamentos";
import { ErroPagamento, type FormaPagamento, type NovaCobranca } from "@/lib/pagamentos/tipos";
import {
  cartaoValido, cepValido, cpfValido, emailValido, soDigitos, telefoneValido, validadeValida,
} from "@/lib/validacao";

export interface EstadoCheckout {
  erro?: string;
  campos?: Record<string, string>;
}

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function pagar(_anterior: EstadoCheckout, f: FormData): Promise<EstadoCheckout> {
  // O preço vem SEMPRE do servidor, nunca do formulário.
  const curso = (await getCursos()).find((c) => c.id === texto(f, "cursoId"));
  if (!curso) return { erro: "Curso não encontrado." };

  const forma = texto(f, "forma") as FormaPagamento;
  if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(forma)) return { erro: "Escolha a forma de pagamento." };

  const comprador = {
    nome: texto(f, "nome"),
    email: texto(f, "email").toLowerCase(),
    cpf: soDigitos(texto(f, "cpf")),
    telefone: soDigitos(texto(f, "telefone")),
  };
  const campos: Record<string, string> = {};
  if (comprador.nome.split(/\s+/).length < 2) campos.nome = "Informe nome e sobrenome.";
  if (!emailValido(comprador.email)) campos.email = "E-mail inválido.";
  if (!cpfValido(comprador.cpf)) campos.cpf = "CPF inválido.";
  if (!telefoneValido(comprador.telefone)) campos.telefone = "Telefone inválido.";

  const nova: NovaCobranca = {
    cursoId: curso.id,
    descricao: `Curso online: ${curso.nome}`,
    valorCentavos: curso.precoCentavos,
    forma,
    comprador,
  };

  if (forma === "CREDIT_CARD") {
    const cartao = {
      nomeNoCartao: texto(f, "nomeNoCartao"),
      numero: soDigitos(texto(f, "numeroCartao")),
      mesValidade: soDigitos(texto(f, "mesValidade")),
      anoValidade: soDigitos(texto(f, "anoValidade")),
      cvv: soDigitos(texto(f, "cvv")),
      cep: soDigitos(texto(f, "cep")),
      numeroEndereco: texto(f, "numeroEndereco"),
    };
    if (cartao.nomeNoCartao.length < 3) campos.nomeNoCartao = "Nome como está no cartão.";
    if (!cartaoValido(cartao.numero)) campos.numeroCartao = "Número do cartão inválido.";
    if (!validadeValida(cartao.mesValidade, cartao.anoValidade)) campos.validade = "Validade inválida.";
    if (cartao.cvv.length < 3 || cartao.cvv.length > 4) campos.cvv = "CVV inválido.";
    if (!cepValido(cartao.cep)) campos.cep = "CEP inválido.";
    if (!cartao.numeroEndereco) campos.numeroEndereco = "Informe o número.";
    const parcelas = Number(texto(f, "parcelas")) || 1;
    if (!opcoesParcelas(curso.precoCentavos).includes(parcelas)) campos.parcelas = "Parcelamento inválido.";
    nova.cartao = cartao;
    nova.parcelas = parcelas;
    const h = await headers();
    nova.ipComprador = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  }

  if (Object.keys(campos).length) return { erro: "Confira os campos destacados.", campos };

  let id: string;
  try {
    id = (await criarCobranca(nova)).id;
  } catch (e) {
    if (e instanceof ErroPagamento) return { erro: e.message };
    console.error("[checkout]", e);
    return { erro: "Não conseguimos concluir agora. Tente novamente em instantes." };
  }
  redirect(`/checkout/pedido/${id}`);
}
