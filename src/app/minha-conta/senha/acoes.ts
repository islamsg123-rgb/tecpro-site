"use server";

import { alunoLogado, loginEmDemonstracao, supabaseDoServidor } from "@/lib/auth";
import { problemaNaSenha } from "@/lib/senha";

export interface EstadoSenha {
  erro?: string;
  ok?: boolean;
}

/** Cria ou troca a senha de quem já está logado (entrou pelo link do e-mail ou com a senha atual). */
export async function definirSenha(_: EstadoSenha, f: FormData): Promise<EstadoSenha> {
  const aluno = await alunoLogado();
  if (!aluno) return { erro: "Sua sessão terminou. Entre de novo pelo link do e-mail." };
  const senha = String(f.get("senha") ?? "");
  const repetir = String(f.get("repetir") ?? "");
  const problema = problemaNaSenha(senha, aluno.email);
  if (problema) return { erro: problema };
  if (senha !== repetir) return { erro: "As duas senhas estão diferentes. Digite a mesma senha nos dois campos." };
  if (loginEmDemonstracao) return { ok: true };

  const { error } = await (await supabaseDoServidor()).auth.updateUser({ password: senha });
  if (error) {
    console.error("[senha]", error.code, error.message);
    if (error.code === "same_password") return { erro: "Essa já é a sua senha atual. Escolha uma diferente." };
    if (error.code === "weak_password") return { erro: "Senha fraca. Use pelo menos 8 caracteres, com letras e números." };
    if (error.code === "reauthentication_needed" || error.status === 401)
      return { erro: "Por segurança, peça um novo link em Entrar › Criar ou recuperar senha e tente de novo." };
    return { erro: "Não foi possível salvar a senha. Tente novamente." };
  }
  return { ok: true };
}
