"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCursos } from "@/lib/cursos";
import { opcoesParcelas } from "@/lib/config-loja";
import { criarCobranca } from "@/lib/pagamentos";
import { ErroPagamento, type FormaPagamento, type NovaCobranca, type Produto } from "@/lib/pagamentos/tipos";
import { alunoLogado } from "@/lib/auth";
import { cursoDoAluno } from "@/lib/area-aluno";
import { situacaoCertificado } from "@/lib/certificados";
import { liberarAcesso } from "@/lib/pagamentos/liberacao";
import { randomUUID } from "node:crypto";
import { aplicarCupom } from "@/lib/cupons";
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

async function itemDaCompra(tipo: string, curso: Curso): Promise<Item | { erro: string }> {
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
  return {
    produto: { tipo: "certificado", cursoId: curso.id, email: aluno.email },
    descricao: `Certificado: ${curso.nome}`,
    valorCentavos: s.regra.precoCentavos,
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
export async function conferirCupom(cursoId: string, tipo: string, codigo: string): Promise<RespostaCupom> {
  const curso = (await getCursos()).find((c) => c.id === cursoId);
  if (!curso) return { ok: false, erro: "Curso não encontrado." };
  const item = await itemDaCompra(tipo, curso);
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
  const item = await itemDaCompra(texto(f, "tipo"), curso);
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
    if (!opcoesParcelas(item.valorCentavos).includes(parcelas)) campos.parcelas = "Parcelamento inválido.";
    nova.cartao = cartao;
    nova.parcelas = parcelas;
    const h = await headers();
    nova.ipComprador = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
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
  if (f.get("termos") !== "on") campos.termos = "Para continuar, aceite os termos de uso.";
  if (Object.keys(campos).length) return { erro: "Confira os campos destacados.", campos };

  await registrarCarrinho({
    email: comprador.email, cursoId: curso.id, tipo: "curso", etapa: "contato", nome: comprador.nome, telefone: comprador.telefone,
  });
  try {
    await liberarAcesso(`gratis-${randomUUID().slice(0, 8)}`, comprador, curso.id);
    await registrarCarrinho({ email: comprador.email, cursoId: curso.id, tipo: "curso", etapa: "matriculado", valorCentavos: 0 });
  } catch (e) {
    console.error("[matricula-gratis]", e);
    return { erro: "Não conseguimos concluir a matrícula agora. Tente novamente em alguns minutos." };
  }
  return { matriculadoEm: comprador.email };
}
