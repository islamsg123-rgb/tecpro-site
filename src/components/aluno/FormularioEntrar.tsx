"use client";

import { useActionState, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { entrar, pedirLinkSenha, type EstadoEntrar } from "@/app/entrar/acoes";
import { IconeCadeado, IconeEmail, IconeSeta } from "../Icones";

type Modo = "link" | "senha" | "criar";

interface Props {
  demonstracao: boolean;
  erroLink: boolean;
  /** Endereço e chave PÚBLICA do Supabase (as mesmas que já vão para o navegador). */
  supabase?: { url: string; chave: string };
}

const campo = "w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100";
const botao = "flex w-full items-center justify-center gap-2 rounded-full bg-laranja-500 py-4 font-bold text-marca-900 transition hover:bg-laranja-400 disabled:opacity-70";

export function FormularioEntrar({ demonstracao, erroLink, supabase }: Props) {
  const [modo, setModo] = useState<Modo>("link");
  const [email, setEmail] = useState(demonstracao ? "aluno@demo.tecpro" : "");
  const [link, acaoLink, enviandoLink] = useActionState<EstadoEntrar, FormData>(entrar, {});
  const [criar, acaoCriar, enviandoCriar] = useActionState<EstadoEntrar, FormData>(pedirLinkSenha, {});
  const enviado = modo === "link" ? link : modo === "criar" ? criar : {};

  if (enviado.enviadoPara) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-laranja-500/15 text-laranja-600">
          <IconeEmail className="h-8 w-8" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-marca-900">Confira seu e-mail</h2>
        <p className="mt-3 text-slate-600">
          Enviamos um link para <strong className="text-marca-900">{enviado.enviadoPara}</strong>.{" "}
          {enviado.paraSenha ? "Clique nele neste mesmo aparelho e você vai direto para a tela de criar a sua senha." : "Clique nele para entrar."} O link vale por 1 hora.
        </p>
        <p className="mt-4 text-sm text-slate-500">Não chegou? Olhe a caixa de spam ou promoções.</p>
      </div>
    );
  }

  const abas = (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 text-sm font-semibold" role="tablist">
      {([["link", "Link por e-mail"], ["senha", "E-mail e senha"]] as const).map(([m, rotulo]) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={modo === m || (m === "senha" && modo === "criar")}
          onClick={() => setModo(m)}
          className={`rounded-full px-3 py-2 transition ${modo === m || (m === "senha" && modo === "criar") ? "bg-white text-marca-900 shadow" : "text-slate-500 hover:text-marca-900"}`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );

  const campoEmail = (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">E-mail</span>
      <input name="email" type="email" autoComplete="username email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
    </label>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold text-marca-900">Entrar</h1>
        <p className="mt-2 text-slate-600">Área do aluno e painel da Tecpro. Use o e-mail da sua matrícula.</p>
      </div>
      {erroLink && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Esse link expirou ou já foi usado. Peça um novo abaixo.</p>}
      {!demonstracao && abas}

      {modo === "link" && (
        <form action={acaoLink} className="space-y-5">
          <p className="text-sm text-slate-500">Enviamos um link para o seu e-mail. É só clicar para entrar, sem precisar de senha.</p>
          {campoEmail}
          {link.erro && <p role="alert" className="text-sm font-medium text-red-600">{link.erro}</p>}
          <button disabled={enviandoLink} className={botao}>
            {enviandoLink ? "Enviando…" : demonstracao ? "Entrar" : "Receber link de acesso"} <IconeSeta className="h-5 w-5" />
          </button>
          {demonstracao && (
            <p className="rounded-xl bg-laranja-300/25 p-3 text-xs text-marca-900">
              <strong>Modo demonstração:</strong> entra direto, sem e-mail. Com <em>aluno@demo.tecpro</em> você vê um aluno com dois cursos.
              Depois de uma compra de teste, entre com o e-mail usado nela.
            </p>
          )}
        </form>
      )}

      {modo === "senha" && supabase && <EntrarComSenha supabase={supabase} email={email} campoEmail={campoEmail} irCriar={() => setModo("criar")} />}

      {modo === "criar" && (
        <form action={acaoCriar} className="space-y-5">
          <div className="rounded-2xl bg-marca-50 p-4 text-sm text-marca-900">
            <p className="flex items-center gap-2 font-bold"><IconeCadeado className="h-5 w-5" /> Criar ou recuperar senha</p>
            <p className="mt-1 text-slate-600">Primeira vez com senha ou esqueceu a sua? Enviamos um link para o seu e-mail. Ao clicar, você cria a nova senha.</p>
          </div>
          {campoEmail}
          {criar.erro && <p role="alert" className="text-sm font-medium text-red-600">{criar.erro}</p>}
          <button disabled={enviandoCriar} className={botao}>
            {enviandoCriar ? "Enviando…" : "Enviar link para criar senha"} <IconeSeta className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setModo("senha")} className="w-full text-center text-sm font-semibold text-marca-700 hover:underline">
            Voltar para entrar com senha
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * O login com senha acontece no navegador, direto com o Supabase. Assim o limite de tentativas
 * do Supabase vale para cada pessoa (pelo endereço dela), e não para o site inteiro.
 */
function EntrarComSenha({ supabase, email, campoEmail, irCriar }: { supabase: { url: string; chave: string }; email: string; campoEmail: React.ReactNode; irCriar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [ver, setVer] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const senha = String(new FormData(e.currentTarget).get("senha") ?? "");
    const mail = email.trim().toLowerCase();
    if (!mail || !senha) return setErro("Digite o e-mail e a senha.");
    setEntrando(true);
    try {
      const cliente = createBrowserClient(supabase.url, supabase.chave);
      const { error } = await cliente.auth.signInWithPassword({ email: mail, password: senha });
      if (error) {
        setEntrando(false);
        // A mesma mensagem para e-mail inexistente e senha errada: ninguém descobre quem tem conta.
        if (error.status === 429) return setErro("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
        return setErro("E-mail ou senha incorretos. Se ainda não criou uma senha, clique em \"Criar ou esqueci a senha\".");
      }
      window.location.assign("/minha-conta");
    } catch {
      setEntrando(false);
      setErro("Não foi possível entrar agora. Tente novamente.");
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      {campoEmail}
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700">
          Senha
          <button type="button" onClick={irCriar} className="text-sm font-semibold text-marca-700 hover:underline">Criar ou esqueci a senha</button>
        </span>
        <input name="senha" type={ver ? "text" : "password"} autoComplete="current-password" required maxLength={72} className={campo} />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="h-4 w-4 accent-marca-900" /> Mostrar senha
      </label>
      {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      <button disabled={entrando} className={botao}>
        {entrando ? "Entrando…" : "Entrar"} <IconeSeta className="h-5 w-5" />
      </button>
    </form>
  );
}
