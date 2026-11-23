"use client";

import { useState } from "react";
import { IconeCheck, IconeCopiar } from "../Icones";

export function BotaoCopiar({ texto, rotulo = "Copiar código" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        } catch {
          /* navegador sem permissão: o código continua visível para copiar à mão */
        }
      }}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-marca-900 px-6 py-3.5 font-bold text-white transition hover:bg-marca-800"
    >
      {copiado ? <IconeCheck className="h-5 w-5 text-laranja-500" /> : <IconeCopiar className="h-5 w-5" />}
      {copiado ? "Copiado!" : rotulo}
    </button>
  );
}
