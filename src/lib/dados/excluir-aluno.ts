import "server-only";
import { randomBytes } from "node:crypto";
import { bancoEmDemonstracao, db } from "./index";
import { listarPedidosMp, salvarPedidoMp } from "./pedidos-mp";

/**
 * Exclusão de um aluno pelo painel (só o dono do site).
 *
 * O que some de vez: login (conta no Supabase), cadastro (nome, CPF, telefone, cidade, observações),
 * progresso nas aulas, cursos removidos e carrinhos/contatos do checkout.
 *
 * O que fica, sem os dados pessoais (ligado a um código "excluido-xxxx" no lugar do e-mail):
 *  - pedidos do Mercado Pago: valor, data e situação continuam no Financeiro; nome, e-mail, CPF e telefone são apagados;
 *  - certificados pagos e créditos de pacote: para os números de certificados vendidos não mudarem;
 *  - pesquisas de satisfação: a nota e o comentário continuam nas médias, sem nome nem e-mail;
 *  - certificados já emitidos: o código continua válido em /validar (o certificado é um documento que o aluno
 *    pode ter entregue a uma empresa); fica só o nome impresso, o curso, a carga horária e a data.
 *
 * Não mexe na Escola Avançada (o aluno continua lá) nem nas cobranças guardadas no Asaas.
 */

export interface ResultadoExclusao {
  login: boolean;
  progresso: number;
  carrinhos: number;
  certificados: number;
  pedidos: number;
  pesquisas: number;
}

export const NOME_EXCLUIDO = "Aluno excluído";
export const ehEmailExcluido = (email: string) => email.startsWith("excluido-");

async function contar(tabela: string, email: string, acao: "delete" | { email: string; extra?: Record<string, unknown> }): Promise<number> {
  const q = db().from(tabela);
  const { data, error } =
    acao === "delete"
      ? await q.delete().eq("email", email).select("email")
      : await q.update({ email: acao.email, ...acao.extra }).eq("email", email).select("email");
  if (error) {
    // Tabela que ainda não existe (SQL não rodado) não impede o resto.
    if (error.code === "42P01" || /does not exist|schema cache/i.test(error.message)) return 0;
    throw new Error(`${tabela}: ${error.message}`);
  }
  return data?.length ?? 0;
}

/** Acha a conta de login pelo e-mail (o Supabase não tem busca direta por e-mail). */
async function idDoLogin(email: string): Promise<string | null> {
  const admin = db().auth.admin;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`login: ${error.message}`);
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export async function excluirAluno(emailAluno: string): Promise<ResultadoExclusao> {
  const email = emailAluno.trim().toLowerCase();
  if (bancoEmDemonstracao) throw new Error("demonstracao");
  const anonimo = `excluido-${randomBytes(4).toString("hex")}`;

  // 1) Financeiro: pedidos do Mercado Pago ficam, sem os dados pessoais.
  const pedidos = (await listarPedidosMp(10000)).filter((p) => p.comprador.email.trim().toLowerCase() === email);
  for (const p of pedidos) {
    await salvarPedidoMp({ ...p, comprador: { nome: NOME_EXCLUIDO, email: anonimo, cpf: "", telefone: "" } });
  }

  // 2) O que fica sem nome nem e-mail.
  const certificados = await contar("certificados", email, { email: anonimo });
  await contar("certificados_pagos", email, { email: anonimo });
  const pesquisas = await contar("pesquisas", email, { email: anonimo, extra: { nome: null } });

  // 3) O que é apagado de vez.
  const progresso = await contar("progresso", email, "delete");
  await contar("cursos_removidos", email, "delete");
  const carrinhos = await contar("carrinhos", email, "delete");
  await contar("alunos", email, "delete");

  // 4) Login: por último, para o aluno não ficar sem conta com dados ainda no banco se algo falhar antes.
  const id = await idDoLogin(email);
  if (id) {
    const { error } = await db().auth.admin.deleteUser(id);
    if (error) throw new Error(`login: ${error.message}`);
  }

  return { login: Boolean(id), progresso, carrinhos, certificados, pedidos: pedidos.length, pesquisas };
}
