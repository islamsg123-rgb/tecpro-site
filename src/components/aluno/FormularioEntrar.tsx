"use client";

import { useActionState } from "react";
import { entrar, type EstadoEntrar } from "@/app/entrar/acoes";
import { IconeEmail, IconeSeta } from "../Icones";

export function FormularioEntrar({ demonstracao, erroLink }: { demonstracao: boolean; erroLink: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(entrar, {});

  if (estado.enviadoPara) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-laranja-500/15 text-laranja-600">
          <IconeEmail className="h-8 w-8" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-marca-900">Confira seu e-mail</h2>
        <p className="mt-3 text-slate-600">
          Enviamos um link de acesso para <strong className="text-marca-900">{estado.enviadoPara}</strong>. Clique nele para entrar. O link vale por 1 hora.
        </p>
        <p className="mt-4 text-sm text-slate-500">Não chegou? Olhe a caixa de spam ou promoções.</p>
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold text-marca-900">Área do aluno</h1>
        <p className="mt-2 text-slate-600">Digite o e-mail usado na compra. Enviamos um link para você entrar, sem precisar de senha.</p>
      </div>
      {erroLink && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Esse link expirou ou já foi usado. Peça um novo abaixo.</p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={demonstracao ? "aluno@demo.tecpro" : undefined}
          className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
        />
      </label>
      {estado.erro && <p role="alert" className="text-sm font-medium text-red-600">{estado.erro}</p>}
      <button
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-laranja-500 py-4 font-bold text-marca-900 transition hover:bg-laranja-400 disabled:opacity-70"
      >
        {enviando ? "Enviando…" : demonstracao ? "Entrar" : "Receber link de acesso"} <IconeSeta className="h-5 w-5" />
      </button>
      {demonstracao && (
        <p className="rounded-xl bg-laranja-300/25 p-3 text-xs text-marca-900">
          <strong>Modo demonstração:</strong> entra direto, sem e-mail. Com <em>aluno@demo.tecpro</em> você vê um aluno com dois cursos.
          Depois de uma compra de teste, entre com o e-mail usado nela.
        </p>
      )}
    </form>
  );
}
