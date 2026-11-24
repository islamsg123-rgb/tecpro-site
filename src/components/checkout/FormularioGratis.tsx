"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { matricularGratis, type EstadoGratis } from "@/app/checkout/acoes";
import { mascaraCpf, mascaraTelefone } from "@/lib/validacao";
import { IconeCheck } from "../Icones";
import { Campo } from "./FormularioCheckout";
import { ESTADOS } from "@/lib/estados";
import { AvisoVisivel } from "../AvisoVisivel";

/** Matrícula em curso gratuito: só os dados do aluno, sem pagamento. */
export function FormularioGratis({ cursoId, nomeInicial, emailInicial, cidadeInicial, estadoInicial, cpfInicial, telefoneInicial }: {
  cursoId: string; nomeInicial?: string; emailInicial?: string; cidadeInicial?: string; estadoInicial?: string; cpfInicial?: string; telefoneInicial?: string;
}) {
  const [estado, acao, enviando] = useActionState<EstadoGratis, FormData>(matricularGratis, {});
  const e = estado.campos ?? {};

  if (estado.matriculadoEm) {
    return (
      <AvisoVisivel className="rounded-3xl border border-green-200 bg-white p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <IconeCheck className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold text-marca-900">Matrícula feita!</h2>
        <p className="mt-2 text-slate-600">
          Seu curso já está liberado. Para começar, entre na área do aluno com o e-mail <strong>{estado.matriculadoEm}</strong>.
        </p>
        <Link href="/entrar" className="mt-6 inline-block rounded-full bg-laranja-500 px-8 py-3.5 font-bold text-marca-900 hover:bg-laranja-400">
          Entrar e começar a estudar
        </Link>
      </AvisoVisivel>
    );
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        const dados = new FormData(ev.currentTarget);
        startTransition(() => acao(dados));
      }}
    >
      <input type="hidden" name="cursoId" value={cursoId} />
      <fieldset className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <legend className="sr-only">Seus dados</legend>
        <h2 className="text-lg font-bold text-marca-900">Seus dados</h2>
        <p className="mt-1 text-sm text-slate-500">O acesso ao curso será enviado para este e-mail.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Campo nome="nome" rotulo="Nome completo" autoComplete="name" defaultValue={nomeInicial} erro={e.nome} className="sm:col-span-2" required />
          <Campo nome="email" rotulo="E-mail" type="email" autoComplete="email" defaultValue={emailInicial} erro={e.email} className="sm:col-span-2" required />
          <Campo nome="cpf" rotulo="CPF" inputMode="numeric" placeholder="000.000.000-00" mascara={mascaraCpf} defaultValue={cpfInicial ? mascaraCpf(cpfInicial) : undefined} erro={e.cpf} required />
          <Campo nome="telefone" rotulo="Celular (WhatsApp)" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" mascara={mascaraTelefone} defaultValue={telefoneInicial ? mascaraTelefone(telefoneInicial) : undefined} erro={e.telefone} required />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Estado</span>
            <select
              name="estado"
              defaultValue={estadoInicial ?? ""}
              aria-invalid={Boolean(e.estado)}
              className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition focus:border-marca-500 focus:ring-4 focus:ring-marca-100 ${e.estado ? "border-red-400" : "border-slate-300"}`}
            >
              <option value="" disabled>Selecione</option>
              {ESTADOS.map(([uf, nome]) => <option key={uf} value={uf}>{nome}</option>)}
            </select>
            {e.estado && <span className="mt-1 block text-xs font-medium text-red-600">{e.estado}</span>}
          </label>
          <Campo nome="cidade" rotulo="Cidade" autoComplete="address-level2" defaultValue={cidadeInicial} erro={e.cidade} required />
        </div>
        <label className="mt-6 flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="termos" className="mt-0.5 h-4 w-4 accent-[#011749]" />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="font-semibold text-marca-700 underline">termos de uso</Link>.
          </span>
        </label>
        {e.termos && <p className="mt-1 text-xs font-medium text-red-600">{e.termos}</p>}
      </fieldset>

      {estado.erro && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{estado.erro}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-full bg-laranja-500 py-4 text-lg font-bold text-marca-900 shadow-lg shadow-laranja-500/30 transition hover:bg-laranja-400 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? "Matriculando…" : "Confirmar matrícula grátis"}
      </button>
    </form>
  );
}
