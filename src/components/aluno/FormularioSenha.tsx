"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { definirSenha, type EstadoSenha } from "@/app/minha-conta/senha/acoes";
import { problemaNaSenha } from "@/lib/senha";
import { IconeCadeado, IconeCheck } from "../Icones";
import { AvisoVisivel } from "../AvisoVisivel";

export function FormularioSenha({ email }: { email: string }) {
  const [estado, acao, salvando] = useActionState<EstadoSenha, FormData>(definirSenha, {});
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);

  if (estado.ok) {
    return (
      <AvisoVisivel className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <IconeCheck className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-marca-900">Senha salva!</h1>
        <p className="mt-3 text-slate-600">
          Na próxima vez, entre com <strong className="text-marca-900">{email}</strong> e a sua senha. O link por e-mail continua funcionando se preferir.
        </p>
        <Link href="/minha-conta" className="mt-6 inline-block rounded-full bg-laranja-500 px-7 py-3 font-bold text-marca-900">Ir para meus cursos</Link>
      </AvisoVisivel>
    );
  }

  const aviso = senha ? problemaNaSenha(senha, email) : null;
  const campo = "w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100";
  return (
    <form action={acao} className="space-y-5">
      <div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-marca-50 text-marca-900"><IconeCadeado className="h-6 w-6" /></span>
        <h1 className="mt-4 text-2xl font-extrabold text-marca-900">Criar ou trocar senha</h1>
        <p className="mt-2 text-sm text-slate-600">
          Conta: <strong className="text-marca-900">{email}</strong>. Com a senha você entra sem esperar o e-mail. Use pelo menos 8 caracteres, com letras e números, e não repita a senha de outros sites.
        </p>
      </div>
      {/* Campo escondido para o gerenciador de senhas do navegador salvar o e-mail junto */}
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Nova senha</span>
        <input name="senha" type={ver ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={72} value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Repita a nova senha</span>
        <input name="repetir" type={ver ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={72} className={campo} />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="h-4 w-4 accent-marca-900" /> Mostrar senha
      </label>
      {aviso && <p className="text-sm text-slate-500">{aviso}</p>}
      {estado.erro && <p role="alert" className="text-sm font-medium text-red-600">{estado.erro}</p>}
      <button disabled={salvando} className="w-full rounded-full bg-laranja-500 py-4 font-bold text-marca-900 transition hover:bg-laranja-400 disabled:opacity-70">
        {salvando ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
