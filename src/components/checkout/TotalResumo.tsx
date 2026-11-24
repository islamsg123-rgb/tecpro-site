"use client";

import { useEffect, useState } from "react";
import { formatarPreco } from "@/lib/formatar";

/** Nome do aviso que o formulário de pagamento dispara quando o total muda (ex.: cupom aplicado). */
export const EVENTO_TOTAL = "tecpro:total";

/** Valor do "Total" no resumo ao lado do checkout. Acompanha o cupom aplicado no formulário. */
export function TotalResumo({ valorCentavos, riscadoCentavos }: { valorCentavos: number; riscadoCentavos?: number }) {
  const [valor, setValor] = useState(valorCentavos);
  useEffect(() => {
    const ouvir = (ev: Event) => {
      const v = Number((ev as CustomEvent<number>).detail);
      if (Number.isFinite(v)) setValor(v);
    };
    window.addEventListener(EVENTO_TOTAL, ouvir);
    return () => window.removeEventListener(EVENTO_TOTAL, ouvir);
  }, []);
  const riscado = valor < valorCentavos ? valorCentavos : riscadoCentavos;
  return (
    <span className="text-right">
      {riscado !== undefined && riscado > valor && (
        <span className="block text-xs text-slate-400 line-through">{formatarPreco(riscado)}</span>
      )}
      <span className="font-display text-2xl font-extrabold text-marca-900">{formatarPreco(valor)}</span>
    </span>
  );
}
