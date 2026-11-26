"use client";

import { useActionState, useEffect, useState } from "react";
import { criarSenhaAlunoAcao, enviarEmailSenhaAcao, type EstadoSenhaAluno } from "@/app/admin/alunos/ficha/acoes-senha";
import { gerarSenhaFacil, problemaNaSenha } from "@/lib/senha";
import { IconeCadeado, IconeCheck, IconeCopiar, IconeEmail } from "../Icones";
import { AvisoVisivel } from "../AvisoVisivel";

export interface LinhaHistoricoSenha {
  quando: string;
  texto: string;
}

/**
 * Seção "Senha de acesso" na ficha do aluno.
 * Principal: criar uma senha para o aluno (definitiva) e mandar no WhatsApp, para quem não recebe o e-mail.
 * Secundário: mandar o e-mail para o próprio aluno criar a senha.
 * A senha atual do aluno nunca aparece: o site não tem como ler senhas, só gravar uma nova.
 */
export function SenhaDoAluno({
  email,
  nome,
  telefone,
  linkEntrar,
  podeCriar,
  protegido,
  temLogin,
  ultimoLogin,
  historico,
}: {
  email: string;
  nome: string;
  telefone: string;
  linkEntrar: string;
  podeCriar: boolean;
  protegido: string | null;
  temLogin: boolean;
  ultimoLogin: string | null;
  historico: LinhaHistoricoSenha[];
}) {
  const [estado, criar, criando] = useActionState<EstadoSenhaAluno, FormData>(criarSenhaAlunoAcao, {});
  const [estadoEmail, enviar, enviando] = useActionState<EstadoSenhaAluno, FormData>(enviarEmailSenhaAcao, {});
  const [senha, setSenha] = useState("");
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Gera no navegador (depois de carregar) para a senha não ir no HTML da página.
  useEffect(() => {
    if (aberto && !senha) setSenha(gerarSenhaFacil());
  }, [aberto, senha]);

  const primeiroNome = nome && nome !== email ? nome.split(" ")[0] : "";
  const mensagem = (s: string) =>
    `Olá${primeiroNome ? `, ${primeiroNome}` : ""}! Aqui é da Tecpro Multi Ensino. Criei a sua senha de acesso aos cursos:\n\n` +
    `Site: ${linkEntrar}\nE-mail: ${email}\nSenha: ${s}\n\n` +
    `É só entrar com o e-mail, apertar Avançar e digitar a senha. Qualquer dúvida, me chame por aqui.`;
  const numero = telefone.replace(/\D/g, "");
  const whats = (s: string) => (numero ? `https://wa.me/${numero.length <= 11 ? `55${numero}` : numero}?text=${encodeURIComponent(mensagem(s))}` : null);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const t = document.createElement("textarea");
      t.value = texto;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  const aviso = senha ? problemaNaSenha(senha.trim(), email) : null;
  const botao = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold";

  return (
    <section id="senha" className="mt-10 scroll-mt-24">
      <h2 className="flex items-center gap-2 text-xl font-bold text-marca-900">
        <IconeCadeado className="h-5 w-5" /> Senha de acesso
      </h2>
      <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <p className="text-slate-600">
          {temLogin ? "O aluno já tem conta de login." : "O aluno ainda não tem conta de login (nunca entrou no site)."}
          {ultimoLogin && <> Último acesso: <strong className="text-marca-900">{ultimoLogin}</strong>.</>}{" "}
          A senha atual nunca aparece aqui: ninguém consegue ver a senha de um aluno, só criar uma nova.
        </p>

        {protegido ? (
          <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{protegido}</p>
        ) : estado.senha ? (
          <AvisoVisivel className="rounded-2xl border-2 border-green-300 bg-green-50 p-5">
            <p className="flex items-center gap-2 font-bold text-green-800">
              <IconeCheck className="h-5 w-5" /> {estado.tipo === "trocada" ? "Senha trocada." : "Senha criada."} Já está valendo.
            </p>
            <p className="mt-1 text-green-900">
              A senha antiga deixou de funcionar. Mande os dados para o aluno agora: <strong>esta senha não aparece de novo</strong> depois que você sair desta página.
            </p>
            <div className="mt-4 rounded-xl border border-green-200 bg-white p-4">
              <p className="text-xs text-slate-500">E-mail: <span className="font-semibold text-marca-900">{email}</span></p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-marca-900">{estado.senha}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => copiar(estado.senha!)} className={`${botao} border border-marca-900 bg-white text-marca-900 hover:bg-marca-50`}>
                {copiado ? <><IconeCheck className="h-4 w-4" /> Copiado</> : <><IconeCopiar className="h-4 w-4" /> Copiar senha</>}
              </button>
              <button type="button" onClick={() => copiar(mensagem(estado.senha!))} className={`${botao} border border-slate-300 bg-white text-slate-700 hover:border-marca-900`}>
                <IconeCopiar className="h-4 w-4" /> Copiar mensagem completa
              </button>
              {whats(estado.senha) ? (
                <a href={whats(estado.senha)!} target="_blank" rel="noopener" className={`${botao} bg-[#25D366] text-white hover:bg-[#1ebe5a]`}>
                  Mandar no WhatsApp
                </a>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-400" title="Preencha o Telefone / WhatsApp nos dados do aluno, acima">
                  Sem celular cadastrado
                </span>
              )}
            </div>
            <p className="mt-3 text-xs text-green-900/80">A mensagem do WhatsApp já vai com o link do site, o e-mail e a senha. Dá para mudar o texto antes de enviar.</p>
          </AvisoVisivel>
        ) : !podeCriar ? (
          <p className="rounded-xl bg-slate-50 p-3 text-slate-600">Só o dono do site pode criar a senha de um aluno. Você pode mandar o e-mail abaixo.</p>
        ) : !aberto ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setAberto(true)} className={`${botao} bg-marca-900 text-white hover:bg-marca-800`}>
              <IconeCadeado className="h-4 w-4" /> Criar nova senha para o aluno
            </button>
            <p className="text-xs text-slate-500">Para quem não recebe o e-mail de acesso. Você cria a senha e manda no WhatsApp.</p>
          </div>
        ) : (
          <form action={criar} className="space-y-3 rounded-xl bg-marca-50/60 p-4">
            <input type="hidden" name="email" value={email} />
            <label className="block font-semibold text-marca-900">
              Nova senha do aluno
              <span className="mt-1 flex flex-wrap gap-2">
                <input
                  name="senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={72}
                  required
                  className="min-w-[220px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-lg font-normal text-marca-900"
                />
                <button type="button" onClick={() => setSenha(gerarSenhaFacil())} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-marca-900 hover:border-marca-900">
                  Gerar outra
                </button>
              </span>
            </label>
            <p className="text-xs text-slate-500">
              Já vem uma senha fácil de digitar no celular. Se preferir, apague e escreva a sua (mínimo 8 caracteres, com letras e números).
            </p>
            {aviso && <p className="text-xs font-medium text-amber-700">{aviso}</p>}
            {estado.erro && <p role="alert" className="font-medium text-red-600">{estado.erro}</p>}
            <p className="text-xs text-slate-600">
              {temLogin ? "Ao salvar, a senha que o aluno usava deixa de funcionar e passa a valer esta." : "Ao salvar, a conta de login do aluno é criada com esta senha."}
            </p>
            <div className="flex flex-wrap gap-3">
              <button disabled={criando || !!aviso} className={`${botao} bg-laranja-500 text-marca-900 hover:bg-laranja-400 disabled:opacity-60`}>
                {criando ? "Salvando…" : "Salvar senha"}
              </button>
              <button type="button" onClick={() => setAberto(false)} className={`${botao} text-slate-500 hover:text-marca-900`}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {!protegido && (
          <form action={enviar} className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="email" value={email} />
            <button disabled={enviando} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-marca-900 hover:text-marca-900 disabled:opacity-60">
              <IconeEmail className="h-4 w-4" /> {enviando ? "Enviando…" : "Ou mandar e-mail para o aluno criar a própria senha"}
            </button>
            {estadoEmail.emailEnviado && <span className="font-medium text-green-700">E-mail enviado para {email}.</span>}
            {estadoEmail.erro && <span role="alert" className="font-medium text-red-600">{estadoEmail.erro}</span>}
          </form>
        )}

        {historico.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Histórico da senha</p>
            <ul className="mt-2 space-y-1">
              {historico.map((h, i) => (
                <li key={i} className="flex flex-wrap gap-x-3">
                  <span className="w-36 shrink-0 text-slate-400">{h.quando}</span>
                  <span className="text-slate-700">{h.texto}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
