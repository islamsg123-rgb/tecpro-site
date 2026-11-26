"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { dadosVitrine } from "@/lib/vitrine-navegador";

/**
 * Google Analytics: liga sozinho quando o código G- está preenchido em Configurações da loja.
 * Não roda no painel (/admin), para não misturar as visitas da equipe com as dos clientes.
 */
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
      if (!d?.ga || !/^G-[A-Z0-9]{4,20}$/.test(d.ga)) return;
      const w = window as Janela;
      w.dataLayer = w.dataLayer || [];
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
      w.gtag("js", new Date());
      w.gtag("config", d.ga, { send_page_view: false });
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${d.ga}`;
      document.head.appendChild(s);
      setId(d.ga);
    });
  }, [pathname, id]);

  // Cada troca de página conta como uma visualização.
  useEffect(() => {
    if (!id || pathname.startsWith("/admin")) return;
    (window as Janela).gtag?.("event", "page_view", { page_path: pathname, page_location: window.location.href, page_title: document.title });
  }, [id, pathname]);

  return null;
}
