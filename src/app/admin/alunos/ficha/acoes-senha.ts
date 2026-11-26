"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eDono, exigirAdmin } from "@/lib/admin";
import { obterFuncionario } from "@/lib/dados/painel";
import { definirSenhaDoAluno, registrarEmailSenha, type TipoMudancaSenha } from "@/lib/dados/senha-aluno";
import { enviarLinkDeAcesso, origemDoLink } from "@/lib/link-acesso";
import { problemaNaSenha } from "@/lib/senha";
import { emailValido } from "@/lib/validacao";

export interface EstadoSenhaAluno {
  erro?: string;
  /** A senha que acabou de ser gravada. Volta só nesta resposta e não é guardada em lugar nenhum. */
  senha?: string;
  tipo?: TipoMudancaSenha;
  emailEnviado?: boolean;
}

/** Contas que não podem ter a senha mudada por aqui (dono do site e funcionários do painel). */
async function contaProtegida(email: string): Promise<string | null> {
  if (eDono(email)) return "Este e-mail é do dono do site. A senha dele só pode ser trocada em Minha senha, pela própria pessoa.";
  const f = await obterFuncionario(email).catch(() => null);
  if (f) return "Esta pessoa é funcionária do painel. Por segurança, ela mesma troca a senha em Minha senha.";
  return null;
}

/** Cria ou troca a senha do aluno. Só o dono do site. A senha passa a valer na hora. */
export async function criarSenhaAlunoAcao(_: EstadoSenhaAluno, f: FormData): Promise<EstadoSenhaAluno> {
  const quem = await exigirAdmin("alunos");
  if (!quem.dono) return { erro: "Só o dono do site pode criar a senha de um aluno." };
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const senha = String(f.get("senha") ?? "").trim();
  if (!emailValido(email)) return { erro: "E-mail do aluno inválido." };
  const protegido = await contaProtegida(email);
  if (protegido) return { erro: protegido };
  const problema = problemaNaSenha(senha, email);
  if (problema) return { erro: problema };

  try {
    const tipo = await definirSenhaDoAluno(email, senha, quem.email);
    revalidatePath("/admin/alunos/ficha");
    return { senha, tipo };
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[senha do aluno]", msg);
    if (/weak|password/i.test(msg)) return { erro: "O sistema de login recusou essa senha (fraca demais). Gere outra." };
    return { erro: "Não foi possível salvar a senha agora. Tente de novo em instantes." };
  }
}

/** Manda o e-mail com link e código para o próprio aluno criar a senha dele. */
export async function enviarEmailSenhaAcao(_: EstadoSenhaAluno, f: FormData): Promise<EstadoSenhaAluno> {
  const quem = await exigirAdmin("alunos");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { erro: "E-mail do aluno inválido." };
  const protegido = await contaProtegida(email);
  if (protegido) return { erro: protegido };

  const h = await headers();
  const origem = origemDoLink(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"));
  const r = await enviarLinkDeAcesso(email, origem, "senha");
  if (r === "aguarde") return { erro: "Um e-mail acabou de ser enviado para este aluno. Aguarde 1 minuto para mandar outro." };
  if (r === "indisponivel") return { erro: "O envio de e-mails não está configurado neste site." };
  if (r === "falhou") return { erro: "O e-mail não foi enviado (o serviço de e-mail recusou). Use a opção de criar a senha acima e mande no WhatsApp." };
  await registrarEmailSenha(email, quem.email).catch(() => {});
  revalidatePath("/admin/alunos/ficha");
  return { emailEnviado: true };
}
