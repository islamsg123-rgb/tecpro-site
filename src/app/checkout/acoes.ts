"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCursos } from "@/lib/cursos";
import { opcoesParcelas } from "@/lib/config-loja";
import { criarCobranca, gatewayAtivo } from "@/lib/pagamentos";
import { enderecoPorCep } from "@/lib/pagamentos/mercadopago";
import { ErroPagamento, type FormaPagamento, type NovaCobranca, type Produto } from "@/lib/pagamentos/tipos";
import { alunoLogado } from "@/lib/auth";
import { cursoDoAluno } from "@/lib/area-aluno";
import { situacaoCertificado } from "@/lib/certificados";
import { liberarAcesso } from "@/lib/pagamentos/liberacao";
import { randomUUID } from "node:crypto";
import { aplicarCupom } from "@/lib/cupons";
import { pacotePorId } from "@/lib/pacotes-certificado";
import { estadoValido } from "@/lib/estados";
import { salvarContatoAluno, salvarLocalidadeAluno } from "@/lib/dados/painel";
import { opcoesParcelas as parcelasPara } from "@/lib/config-loja";
import { contarUsoCupom, registrarCarrinho } from "@/lib/dados/carrinhos";
import type { Curso } from "@/lib/types";
import {
  cartaoValido, cepValido, cpfValido, emailValido, soDigitos, telefoneValido, validadeValida,
} from "@/lib/validacao";

export interface EstadoCheckout {
  erro?: string;
  campos?: Record<string, string>;
}

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

type Item = { produto: Produto; descricao: string; valorCentavos: number };

async function itemDaCompra(tipo: string, curso: Curso, idPacote = ""): Promise<Item | { erro: string }> {
  if (tipo !== "certificado") {
    if (!curso.visivel) return { erro: "Este curso não está disponível para venda no momento." };
    if (curso.gratuito) return { erro: "Este curso é gratuito: volte à página do curso para se matricular." };
    return { produto: { tipo: "curso", cursoId: curso.id }, descricao: `Curso online: ${curso.nome}`, valorCentavos: curso.precoCentavos };
  }
  // Certificado: só para o aluno logado, que concluiu o curso e ainda não pagou.
  const aluno = await alunoLogado();
  if (!aluno) return { erro: "Entre na área do aluno para pagar o certificado." };
  const c = await cursoDoAluno(aluno.email, curso.slug);
  const s = await situacaoCertificado(aluno.email, c);
  if (s.estado !== "aguardando_pagamento" || s.regra.modo !== "pago") return { erro: "Este certificado não está aguardando pagamento." };
  // Individual ou pacote (3 ou 5 certificados): o preço vem das Configurações da loja, nunca do navegador.
  const pacote = await pacotePorId(idPacote || "individual");
  if (!pacote) return { erro: "Escolha uma opção de certificado." };
  return {
    produto: { tipo: "certificado", cursoId: curso.id, email: aluno.email, quantidade: pacote.quantidade },
    descricao: pacote.quantidade > 1
      ? `${pacote.nome} (${pacote.quantidade} certificados): ${curso.nome} + ${pacote.quantidade - 1} créditos`
      : `Certificado: ${curso.nome}`,
    valorCentavos: pacote.precoCentavos,
  };
}

function lerComprador(f: FormData) {
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
  return { comprador, campos };
}

const tipoDoForm = (f: FormData) => (texto(f, "tipo") === "certificado" ? "certificado" : "curso") as "curso" | "certificado";

/**
 * Etapa 1 do checkout: guarda nome e contato antes do pagamento.
 * Assim, quem não terminar aparece em "Carrinhos abandonados" no painel.
 */
export async function salvarContato(f: FormData): Promise<EstadoCheckout & { ok?: boolean }> {
  const curso = (await getCursos()).find((c) => c.id === texto(f, "cursoId"));
  if (!curso) return { erro: "Curso não encontrado." };
  const { comprador, campos } = lerComprador(f);
  if (Object.keys(campos).length) return { erro: "Confira os campos destacados.", campos };
  await registrarCarrinho({
    email: comprador.email, cursoId: curso.id, tipo: tipoDoForm(f), etapa: "contato",
    nome: comprador.nome, telefone: comprador.telefone,
  });
  return { ok: true };
}

export type RespostaCupom =
  | { ok: true; codigo: string; valorCentavos: number; descontoCentavos: number; rotulo: string; parcelas: number[] }
  | { ok: false; erro: string };

/** Confere o cupom digitado no checkout e devolve o novo valor (o pagamento confere de novo). */
export async function conferirCupom(cursoId: string, tipo: string, codigo: string, pacote = ""): Promise<RespostaCupom> {
  const curso = (await getCursos()).find((c) => c.id === cursoId);
  if (!curso) return { ok: false, erro: "Curso não encontrado." };
  const item = await itemDaCompra(tipo, curso, pacote);
  if ("erro" in item) return { ok: false, erro: item.erro };
  const r = await aplicarCupom(codigo, { tipo: item.produto.tipo, cursoId: curso.id, valorCentavos: item.valorCentavos });
  if (!r.ok) return r;
  return {
    ok: true, codigo: r.cupom.codigo, valorCentavos: r.valorFinalCentavos, descontoCentavos: r.descontoCentavos,
    rotulo: r.rotulo, parcelas: parcelasPara(r.valorFinalCentavos),
  };
}

export async function pagar(_anterior: EstadoCheckout, f: FormData): Promise<EstadoCheckout> {
  // O que está sendo comprado e o preço vêm SEMPRE do servidor, nunca do formulário.
  const curso = (await getCursos()).find((c) => c.id === texto(f, "cursoId"));
  if (!curso) return { erro: "Curso não encontrado." };
  const item = await itemDaCompra(texto(f, "tipo"), curso, texto(f, "pacote"));
  if ("erro" in item) return item;

  const forma = texto(f, "forma") as FormaPagamento;
  if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(forma)) return { erro: "Escolha a forma de pagamento." };

  const { comprador, campos } = lerComprador(f);

  // Cupom: conferido de novo aqui, nunca confiamos no valor vindo do navegador.
  const codigoCupom = texto(f, "cupom");
  let cupomUsado: string | null = null;
  if (codigoCupom) {
    const r = await aplicarCupom(codigoCupom, { tipo: item.produto.tipo, cursoId: curso.id, valorCentavos: item.valorCentavos });
    if (!r.ok) return { erro: r.erro };
    item.valorCentavos = r.valorFinalCentavos;
    item.descricao += ` (cupom ${r.cupom.codigo})`;
    cupomUsado = r.cupom.codigo;
  }

  const nova: NovaCobranca = {
    produto: item.produto,
    descricao: item.descricao,
    valorCentavos: item.valorCentavos,
    forma,
    comprador,
  };

  const gateway = await gatewayAtivo();
  const parcelas = Number(texto(f, "parcelas")) || 1;

  if (forma === "CREDIT_CARD" && gateway === "mercadopago") {
    // O navegador já trocou o cartão por um token do Mercado Pago: o número do cartão não chega aqui.
    const token = texto(f, "mpToken");
    const bandeira = texto(f, "mpBandeira");
    if (!token || !bandeira) campos.numeroCartao = "Confira os dados do cartão.";
    if (!opcoesParcelas(item.valorCentavos).includes(parcelas)) campos.parcelas = "Parcelamento inválido.";
    nova.cartaoMp = { token, bandeira, emissor: texto(f, "mpEmissor") || undefined };
    nova.parcelas = parcelas;
  } else if (forma === "CREDIT_CARD") {
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
    if (!opcoesParcelas(item.valorCentavos).includes(parcelas)) campos.parcelas = "Parcelamento inválido.";
    nova.cartao = cartao;
    nova.parcelas = parcelas;
    const h = await headers();
    nova.ipComprador = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  } else if (forma === "BOLETO" && gateway === "mercadopago") {
    // O boleto do Mercado Pago exige endereço: pedimos só CEP e número e completamos pelo CEP.
    const cep = soDigitos(texto(f, "cepBoleto"));
    const numero = texto(f, "numeroBoleto").slice(0, 20);
    if (!cepValido(cep)) campos.cepBoleto = "CEP inválido.";
    if (!numero) campos.numeroBoleto = "Informe o número (ou S/N).";
    if (!campos.cepBoleto) {
      const end = await enderecoPorCep(cep);
      if (!end) campos.cepBoleto = "Não encontramos este CEP.";
      else nova.endereco = { cep, numero, ...end };
    }
  }

  if (Object.keys(campos).length) return { erro: "Confira os campos destacados.", campos };

  let id: string;
  try {
    const cobranca = await criarCobranca(nova);
    id = cobranca.id;
    if (cupomUsado) await contarUsoCupom(cupomUsado);
    // Pix/boleto gerado (ou cartão em análise): fica como "pagamento" até o aviso de pago chegar.
    if (cobranca.situacao !== "pago") {
      await registrarCarrinho({
        email: comprador.email, cursoId: curso.id, tipo: item.produto.tipo, etapa: "pagamento",
        nome: comprador.nome, telefone: comprador.telefone, forma, cobrancaId: id,
        valorCentavos: item.valorCentavos, cupom: cupomUsado,
      });
    }
  } catch (e) {
    if (e instanceof ErroPagamento) return { erro: e.message };
    console.error("[checkout]", e);
    return { erro: "Não conseguimos concluir agora. Tente novamente em instantes." };
  }
  redirect(`/checkout/pedido/${id}`);
}

export interface EstadoGratis {
  erro?: string;
  campos?: Record<string, string>;
  /** E-mail do aluno, quando a matrícula deu certo. */
  matriculadoEm?: string;
}

/** Matrícula em curso gratuito: cria o aluno e libera o curso na Escola Avançada, sem cobrança. */
export async function matricularGratis(_anterior: EstadoGratis, f: FormData): Promise<EstadoGratis> {
  const curso = (await getCursos()).find((c) => c.id === texto(f, "cursoId"));
  // O servidor confere de novo que o curso é mesmo gratuito e está na vitrine.
  if (!curso || !curso.visivel || !curso.gratuito) return { erro: "Este curso não está disponível para matrícula gratuita." };

  const { comprador, campos } = lerComprador(f);
  const estado = texto(f, "estado").toUpperCase();
  const cidade = texto(f, "cidade").replace(/\s+/g, " ").slice(0, 80);
  if (!estadoValido(estado)) campos.estado = "Escolha o seu estado.";
  if (cidade.length < 2) campos.cidade = "Informe a sua cidade.";
  if (f.get("termos") !== "on") campos.termos = "Para continuar, aceite os termos de uso.";
  if (Object.keys(campos).length) return { erro: "Confira os campos destacados.", campos };

  await registrarCarrinho({
    email: comprador.email, cursoId: curso.id, tipo: "curso", etapa: "contato", nome: comprador.nome, telefone: comprador.telefone,
  });
  try {
    await liberarAcesso(`gratis-${randomUUID().slice(0, 8)}`, comprador, curso.id);
    // Sem o SQL da cidade/estado, a matrícula segue normalmente.
    await salvarContatoAluno(comprador.email, comprador.cpf, comprador.telefone).catch((e) => console.warn("[matricula-gratis] cpf/celular", e));
    await salvarLocalidadeAluno(comprador.email, cidade, estado).catch((e) => console.warn("[matricula-gratis] cidade/estado", e));
    await registrarCarrinho({ email: comprador.email, cursoId: curso.id, tipo: "curso", etapa: "matriculado", valorCentavos: 0 });
  } catch (e) {
    console.error("[matricula-gratis]", e);
    return { erro: "Não conseguimos concluir a matrícula agora. Tente novamente em alguns minutos." };
  }
  return { matriculadoEm: comprador.email };
}
