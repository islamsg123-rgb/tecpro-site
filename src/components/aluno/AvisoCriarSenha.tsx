"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { adiarAvisoSenha, jaTenhoSenha } from "@/app/minha-conta/senha/acoes";
import { IconeCadeado } from "../Icones";

/**
 * Faixa na área do aluno para quem entrou pelo código/link do e-mail e ainda não tem senha.
 * Com senha, a pessoa entra na hora, sem esperar e-mail (e a escola gasta menos envios).
 */
export function AvisoCriarSenha() {
  const pathname = usePathname();
  const [fechado, setFechado] = useState(false);
  const [, iniciar] = useTransition();
  if (fechado || pathname.startsWith("/minha-conta/senha")) return null;

  const fechar = (acao: () => Promise<void>) => {
    setFechado(true);
    iniciar(() => acao());
  };

  return (
    <div className="border-b border-laranja-500/30 bg-laranja-500/10">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-laranja-500 text-marca-900 sm:flex">
          <IconeCadeado className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-marca-900">Crie sua senha e entre mais rápido da próxima vez</p>
          <p className="text-sm text-slate-600">Com a senha você entra na hora, sem precisar esperar um código no e-mail. Leva 1 minuto.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          <Link href="/minha-conta/senha" className="rounded-full bg-laranja-500 px-5 py-2.5 text-sm font-bold text-marca-900 hover:bg-laranja-400">
            Criar minha senha
          </Link>
          <button type="button" onClick={() => fechar(adiarAvisoSenha)} className="rounded-full px-2.5 py-2.5 text-sm font-semibold text-slate-600 hover:text-marca-900">
            Agora não
          </button>
          <button type="button" onClick={() => fechar(jaTenhoSenha)} className="rounded-full px-2.5 py-2.5 text-sm font-semibold text-slate-600 hover:text-marca-900">
            Já tenho senha
          </button>
        </div>
      </div>
    </div>
  );
}
