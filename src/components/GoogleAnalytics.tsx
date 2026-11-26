"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { dadosVitrine } from "@/lib/vitrine-navegador";

/**
 * Google Analytics (G-) ou Google Tag Manager (GTM-): liga sozinho com o código de Configurações da loja.
 * Não roda no painel (/admin), para não misturar as visitas da equipe com as dos clientes.
 */
/** Coloca o script do Google uma única vez na página. */
function carregar(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

let instalado: string | null = null; // uma vez por visita, mesmo se o efeito rodar de novo

type Janela = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };

export function GoogleAnalytics() {
  const pathname = usePathname();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/admin") || id) return;
    try {
      if (localStorage.getItem("tecpro:equipe") === "1") return;
    } catch {
      /* segue */
    }
    dadosVitrine().then((d) => {
      const codigo = d?.ga ?? "";
      if (instalado) return setId(instalado);
      if (codigo) instalado = codigo;
      const w = window as Janela;
      w.dataLayer = w.dataLayer || [];
      if (/^GTM-[A-Z0-9]{4,20}$/.test(codigo)) {
        // Google Tag Manager: o contêiner decide o que medir (o Analytics fica configurado lá dentro).
        w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
        carregar(`https://www.googletagmanager.com/gtm.js?id=${codigo}`);
        setId(codigo);
        return;
      }
      if (!/^G-[A-Z0-9]{4,20}$/.test(codigo)) return;
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
      w.gtag("js", new Date());
      w.gtag("config", codigo, { send_page_view: false });
      carregar(`https://www.googletagmanager.com/gtag/js?id=${codigo}`);
      setId(codigo);
    });
  }, [pathname, id]);

  // Cada troca de página conta como uma visualização.
  // No Tag Manager, o próprio Analytics (medição otimizada) percebe a troca de página; aqui só avisamos no dataLayer.
  useEffect(() => {
    if (!id || pathname.startsWith("/admin")) return;
    if (id.startsWith("GTM-")) {
      (window as Janela).dataLayer?.push({ event: "troca_de_pagina", page_path: pathname });
      return;
    }
    (window as Janela).gtag?.("event", "page_view", { page_path: pathname, page_location: window.location.href, page_title: document.title });
  }, [id, pathname]);

  return null;
}
