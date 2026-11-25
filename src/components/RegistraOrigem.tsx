"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { COOKIE_ORIGEM, DIAS_ORIGEM, descobrirOrigem, origemParaCookie } from "@/lib/origem";

/** Guarda por onde a pessoa chegou ao site (Instagram, Google...), para o painel saber de onde veio cada venda. */
export function RegistraOrigem() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    try {
      const o = descobrirOrigem(new URL(window.location.href), document.referrer, window.location.hostname);
      if (o) document.cookie = `${COOKIE_ORIGEM}=${origemParaCookie(o)}; path=/; max-age=${DIAS_ORIGEM * 86400}; samesite=lax`;
    } catch {
      /* sem cookie: a venda só fica sem origem */
    }
    // Só na chegada: a página anterior (referrer) não muda nas trocas de página internas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
