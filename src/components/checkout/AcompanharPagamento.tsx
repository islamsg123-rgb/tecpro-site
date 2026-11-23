"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Pergunta ao servidor a cada 5 s se o pagamento já caiu; quando cai, recarrega a tela do pedido. */
export function AcompanharPagamento({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    let ativo = true;
    const verificar = async () => {
      try {
        const r = await fetch(`/api/pagamentos/${id}`, { cache: "no-store" });
        const { situacao } = (await r.json()) as { situacao?: string };
        if (ativo && situacao && situacao !== "aguardando") router.refresh();
      } catch {
        /* sem internet por um instante: tenta de novo no próximo ciclo */
      }
    };
    const t = setInterval(verificar, 5000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [id, router]);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-laranja-500 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-laranja-500" />
      </span>
      Aguardando pagamento. Esta tela atualiza sozinha.
    </span>
  );
}
