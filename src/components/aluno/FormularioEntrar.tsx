"use client";

import { useActionState, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { avancar, entrar, pedirLinkSenha, type EstadoAvancar } from "@/app/entrar/acoes";
import { IconeEmail, IconeSeta } from "../Icones";
import { AvisoVisivel } from "../AvisoVisivel";

/** Mesmo nome usado em lib/auth.ts (MARCA_TEM_SENHA); repetido aqui porque aquele arquivo só roda no servidor. */
const MARCA_TEM_SENHA = "tem_senha";

type Etapa = "email" | "senha" | "codigo";

interface Props {
  demonstracao: boolean;
  erroLink: boolean;
  /** Endereço e chave PÚBLICA do Supabase (as mesmas que já vão para o navegador). */
  supabase?: { url: string; chave: string };
}

const campo = "w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100";
const botao = "flex w-full items-center justify-center gap-2 rounded-full bg-laranja-500 py-4 font-bold text-marca-900 transition hover:bg-laranja-400 disabled:opacity-70";
const linkPequeno = "text-sm font-semibold text-marca-700 hover:underline";

/**
 * Entrar em dois passos, para não confundir com muitos botões:
 *  1) a pessoa digita só o e-mail e aperta Avançar;
 *  2) se a conta já tem senha, pede a senha; se não tem (ou é aluno novo), manda um código
 *     para o e-mail e, depois do código, a pessoa cria a senha.
 */
export function FormularioEntrar({ demonstracao, erroLink, supabase }: Props) {
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState(demonstracao ? "aluno@demo.tecpro" : "");
  const [erroEsqueci, setErroEsqueci] = useState<string | null>(null);
  const [enviandoEsqueci, setEnviandoEsqueci] = useState(false);

  const [passo1, acaoAvancar, avancando] = useActionState<EstadoAvancar, FormData>(async (antes, f) => {
    const r = await avancar(antes, f);
    if (r.pedirSenha) setEtapa("senha");
    else if (r.enviadoPara) setEtapa("codigo");
    return r;
  }, {});

  async function esqueci() {
    setErroEsqueci(null);
    setEnviandoEsqueci(true);
    const f = new FormData();
    f.set("email", email);
    const r = await pedirLinkSenha({}, f);
    setEnviandoEsqueci(false);
    if (r.erro) return setErroEsqueci(r.erro);
    setEtapa("codigo");
  }

  const voltarAoEmail = () => {
    setErroEsqueci(null);
    setEtapa("email");
  };

  const contaEscolhida = (
    <div className="flex items-center justify-between gap-3 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-4 pr-1.5 text-sm">
      <span className="min-w-0 truncate font-semibold text-marca-900">{email}</span>
      <button type="button" onClick={voltarAoEmail} className="shrink-0 rounded-full px-3 py-1.5 font-semibold text-marca-700 hover:bg-white">
        Trocar
      </button>
    </div>
  );

  if (etapa === "codigo") {
    return (
      <AvisoVisivel className="space-y-5">
        <div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-laranja-500/15 text-laranja-600">
            <IconeEmail className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-3xl font-extrabold text-marca-900">Confira seu e-mail</h1>
          <p className="mt-2 text-slate-600">
            Enviamos um código para o seu e-mail. Digite abaixo e, em seguida, crie a sua senha. Nas próximas vezes você entra só com a senha.
          </p>
        </div>
        {contaEscolhida}
        {supabase ? (
          <EntrarComCodigo supabase={supabase} email={email} destino="/minha-conta/senha" />
        ) : (
          <CodigoDemonstracao email={email} />
        )}
        <p className="text-sm text-slate-500">Não chegou? Olhe a caixa de spam ou promoções. O código vale por 1 hora.</p>
        <button type="button" onClick={() => setEtapa("senha")} className={`${linkPequeno} block w-full text-center`}>
          Já tenho senha
        </button>
      </AvisoVisivel>
    );
  }

  if (etapa === "senha") {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-extrabold text-marca-900">Digite sua senha</h1>
          <p className="mt-2 text-slate-600">Que bom te ver de novo!</p>
        </div>
        {contaEscolhida}
        <EntrarComSenha supabase={supabase} email={email} />
        {erroEsqueci && <p role="alert" className="text-sm font-medium text-red-600">{erroEsqueci}</p>}
        <button type="button" disabled={enviandoEsqueci} onClick={esqueci} className={`${linkPequeno} block w-full text-center disabled:opacity-60`}>
          {enviandoEsqueci ? "Enviando código…" : "Esqueci a senha"}
        </button>
      </div>
    );
  }

  return (
    <form action={acaoAvancar} className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold text-marca-900">Entrar</h1>
        <p className="mt-2 text-slate-600">Digite o e-mail da sua matrícula.</p>
      </div>
      {erroLink && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Esse link expirou ou já foi usado. Digite o seu e-mail para receber um novo código.</p>}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="username email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={campo}
        />
      </label>
      {passo1.erro && <p role="alert" className="text-sm font-medium text-red-600">{passo1.erro}</p>}
      <button disabled={avancando} className={botao}>
        {avancando ? "Verificando…" : "Avançar"} <IconeSeta className="h-5 w-5" />
      </button>
      {demonstracao && (
        <p className="rounded-xl bg-laranja-300/25 p-3 text-xs text-marca-900">
          <strong>Modo demonstração:</strong> <em>aluno@demo.tecpro</em> tem senha (qualquer uma serve). Outro e-mail mostra a tela do código (qualquer código serve).
        </p>
      )}
    </form>
  );
}

/** Modo demonstração: qualquer código entra e leva à tela de criar senha. */
function CodigoDemonstracao({ email }: { email: string }) {
  const [entrando, setEntrando] = useState(false);
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEntrando(true);
    const f = new FormData();
    f.set("email", email);
    await pedirLinkSenha({}, f);
  }
  return (
    <form onSubmit={enviar} className="space-y-3">
      <input inputMode="numeric" placeholder="000000" maxLength={12} className={`${campo} text-center text-2xl font-bold tracking-[0.4em]`} />
      <button disabled={entrando} className={botao}>
        {entrando ? "Entrando…" : "Continuar"} <IconeSeta className="h-5 w-5" />
      </button>
    </form>
  );
}

/**
 * O login com senha acontece no navegador, direto com o Supabase. Assim o limite de tentativas
 * do Supabase vale para cada pessoa (pelo endereço dela), e não para o site inteiro.
 */
function EntrarComSenha({ supabase, email }: { supabase?: { url: string; chave: string }; email: string }) {
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
        return setErro("Senha incorreta. Tente de novo ou clique em \"Esqueci a senha\".");
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
      {/* E-mail escondido para o gerenciador de senhas do navegador salvar junto */}
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Senha</span>
        <input name="senha" type={ver ? "text" : "password"} autoComplete="current-password" required autoFocus maxLength={72} className={campo} />
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
    <form onSubmit={enviar} className="space-y-3 text-left">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Código do e-mail</span>
        <input
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={12}
          placeholder="000000"
          autoFocus
          className={`${campo} text-center text-2xl font-bold tracking-[0.4em]`}
        />
      </label>
      {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      <button disabled={entrando} className={botao}>
        {entrando ? "Conferindo…" : "Continuar"} <IconeSeta className="h-5 w-5" />
      </button>
    </form>
  );
}
