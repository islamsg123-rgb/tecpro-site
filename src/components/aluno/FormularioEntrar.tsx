"use client";

import { useActionState, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { entrar, pedirLinkSenha, type EstadoEntrar } from "@/app/entrar/acoes";
import { IconeEmail, IconeSeta } from "../Icones";
import { AvisoVisivel } from "../AvisoVisivel";

/** Mesmo nome usado em lib/auth.ts (MARCA_TEM_SENHA); repetido aqui porque aquele arquivo só roda no servidor. */
const MARCA_TEM_SENHA = "tem_senha";

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
  // Caminho principal: e-mail e senha. Código/link por e-mail fica para o primeiro acesso,
  // para quem esqueceu a senha e para quem prefere entrar sem senha (gasta um e-mail por vez).
  const [modo, setModo] = useState<Modo>(erroLink ? "criar" : "senha");
  const [email, setEmail] = useState(demonstracao ? "aluno@demo.tecpro" : "");
  const [link, acaoLink, enviandoLink] = useActionState<EstadoEntrar, FormData>(entrar, {});
  const [criar, acaoCriar, enviandoCriar] = useActionState<EstadoEntrar, FormData>(pedirLinkSenha, {});
  const enviado = modo === "link" ? link : modo === "criar" ? criar : {};

  if (enviado.enviadoPara) {
    return (
      <AvisoVisivel className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-laranja-500/15 text-laranja-600">
          <IconeEmail className="h-8 w-8" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-marca-900">Confira seu e-mail</h2>
        <p className="mt-3 text-slate-600">
          Enviamos um código e um link para <strong className="text-marca-900">{enviado.enviadoPara}</strong>.{" "}
          {enviado.comCodigo
            ? enviado.paraSenha
              ? "Digite o código abaixo ou clique no link (pode ser no celular ou em outro navegador). Em seguida você cria a sua senha."
              : "Digite o código abaixo ou clique no link (pode ser no celular ou em outro navegador) para entrar."
            : enviado.paraSenha
              ? "Clique nele neste mesmo aparelho e você vai direto para a tela de criar a sua senha."
              : "Clique nele para entrar."}{" "}
          Vale por 1 hora.
        </p>
        {enviado.comCodigo && supabase && (
          <EntrarComCodigo supabase={supabase} email={enviado.enviadoPara} destino={enviado.paraSenha ? "/minha-conta/senha" : "/minha-conta"} />
        )}
        <p className="mt-4 text-sm text-slate-500">Não chegou? Olhe a caixa de spam ou promoções. Se pedir de novo, use sempre o e-mail mais recente.</p>
      </AvisoVisivel>
    );
  }

  const campoEmail = (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">E-mail</span>
      <input name="email" type="email" autoComplete="username email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
    </label>
  );

  const voltar = (
    <button type="button" onClick={() => setModo("senha")} className="w-full text-center text-sm font-semibold text-marca-700 hover:underline">
      Voltar para entrar com senha
    </button>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold text-marca-900">{modo === "criar" ? "Primeiro acesso" : "Entrar"}</h1>
        <p className="mt-2 text-slate-600">
          {modo === "criar" ? "Ou esqueceu a senha? Sem problema, é rápido." : "Área do aluno e painel da Tecpro. Use o e-mail da sua matrícula."}
        </p>
      </div>
      {erroLink && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Esse link expirou ou já foi usado. Peça um novo código abaixo e use sempre o e-mail mais recente.</p>}

      {modo === "senha" && (
        <>
          <EntrarComSenha supabase={supabase} email={email} campoEmail={campoEmail} irCriar={() => setModo("criar")} />
          <div className="rounded-2xl border border-marca-100 bg-marca-50 p-4 text-sm">
            <p className="font-bold text-marca-900">Primeiro acesso ou ainda não tem senha?</p>
            <p className="mt-1 text-slate-600">Já é aluno, mas sempre entrou pelo e-mail? Receba um código e crie sua senha agora.</p>
            <button type="button" onClick={() => setModo("criar")} className="mt-3 w-full rounded-full border-2 border-marca-900 py-2.5 font-bold text-marca-900 transition hover:bg-marca-900 hover:text-white">
              Criar minha senha
            </button>
          </div>
          <button type="button" onClick={() => setModo("link")} className="w-full text-center text-sm text-slate-500 hover:text-marca-900 hover:underline">
            Prefere entrar sem senha? Receber código por e-mail
          </button>
        </>
      )}

      {modo === "criar" && (
        <form action={acaoCriar} className="space-y-5">
          <ol className="space-y-2 rounded-2xl bg-marca-50 p-4 text-sm text-slate-700">
            {["Digite o e-mail da sua matrícula", "Enviamos um código para o seu e-mail", "Digite o código e crie a sua senha"].map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca-900 text-xs font-bold text-white">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          {campoEmail}
          {criar.erro && <p role="alert" className="text-sm font-medium text-red-600">{criar.erro}</p>}
          <button disabled={enviandoCriar} className={botao}>
            {enviandoCriar ? "Enviando…" : "Receber código"} <IconeSeta className="h-5 w-5" />
          </button>
          {voltar}
        </form>
      )}

      {modo === "link" && (
        <form action={acaoLink} className="space-y-5">
          <p className="text-sm text-slate-500">
            Enviamos um código para o seu e-mail e você entra sem senha. Dica: criando uma senha você entra na hora, sem esperar o e-mail.
          </p>
          {campoEmail}
          {link.erro && <p role="alert" className="text-sm font-medium text-red-600">{link.erro}</p>}
          <button disabled={enviandoLink} className={botao}>
            {enviandoLink ? "Enviando…" : "Receber código de acesso"} <IconeSeta className="h-5 w-5" />
          </button>
          {voltar}
        </form>
      )}

      {demonstracao && (
        <p className="rounded-xl bg-laranja-300/25 p-3 text-xs text-marca-900">
          <strong>Modo demonstração:</strong> entra direto, com qualquer senha e sem e-mail. Com <em>aluno@demo.tecpro</em> você vê um aluno com dois cursos.
        </p>
      )}
    </div>
  );
}

/**
 * O login com senha acontece no navegador, direto com o Supabase. Assim o limite de tentativas
 * do Supabase vale para cada pessoa (pelo endereço dela), e não para o site inteiro.
 */
function EntrarComSenha({ supabase, email, campoEmail, irCriar }: { supabase?: { url: string; chave: string }; email: string; campoEmail: React.ReactNode; irCriar: () => void }) {
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
    if (!supabase) {
      // Modo demonstração: não há senha de verdade; entra direto.
      const f = new FormData();
      f.set("email", mail);
      await entrar({}, f);
      return;
    }
    try {
      const cliente = createBrowserClient(supabase.url, supabase.chave);
      const { data, error } = await cliente.auth.signInWithPassword({ email: mail, password: senha });
      if (error) {
        setEntrando(false);
        // A mesma mensagem para e-mail inexistente e senha errada: ninguém descobre quem tem conta.
        if (error.status === 429) return setErro("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
        return setErro("E-mail ou senha incorretos. Se ainda não criou uma senha, clique em \"Criar minha senha\" logo abaixo.");
      }
      // Quem já tinha senha antes desta marca existir: marca agora, para não ver o aviso "crie sua senha".
      if (data.user?.user_metadata?.[MARCA_TEM_SENHA] !== true) {
        await cliente.auth.updateUser({ data: { [MARCA_TEM_SENHA]: true } }).catch(() => null);
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
          <button type="button" onClick={irCriar} className="text-sm font-semibold text-marca-700 hover:underline">Esqueci a senha</button>
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

/**
 * Plano B do link: o e-mail traz um código. A pessoa digita aqui e entra, sem depender de abrir o link.
 * A conferência é feita no navegador, direto com o Supabase, para o limite de tentativas valer por pessoa.
 */
function EntrarComCodigo({ supabase, email, destino }: { supabase: { url: string; chave: string }; email: string; destino: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const codigo = String(new FormData(e.currentTarget).get("codigo") ?? "").replace(/\D/g, "");
    if (codigo.length < 6) return setErro("Digite o código que veio no e-mail.");
    setEntrando(true);
    try {
      const cliente = createBrowserClient(supabase.url, supabase.chave);
      const { error } = await cliente.auth.verifyOtp({ email, token: codigo, type: "email" });
      if (error) {
        setEntrando(false);
        if (error.status === 429) return setErro("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
        return setErro("Código incorreto ou vencido. Confira o e-mail mais recente.");
      }
      window.location.assign(destino);
    } catch {
      setEntrando(false);
      setErro("Não foi possível entrar agora. Tente novamente.");
    }
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4 text-left">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Ou digite o código do e-mail</span>
        <input
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={12}
          placeholder="000000"
          className={`${campo} text-center text-2xl font-bold tracking-[0.4em]`}
        />
      </label>
      {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      <button disabled={entrando} className={botao}>
        {entrando ? "Entrando…" : "Entrar com o código"} <IconeSeta className="h-5 w-5" />
      </button>
    </form>
  );
}
