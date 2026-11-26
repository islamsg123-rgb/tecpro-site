"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { INTERVALO_SINAL_MS, lugarDoCaminho } from "@/lib/online";

/**
 * Avisa o site "estou aqui" para o quadro "Online agora" do painel.
 * Manda um sinal ao abrir cada página e depois 1 por minuto, só enquanto a aba está na frente
 * (aba escondida não gasta nada). A equipe do painel não conta: o navegador de quem entrou no painel fica marcado.
 */
export const CHAVE_EQUIPE = "tecpro:equipe";
const CHAVE_VISITANTE = "tecpro:visitante";

function visitante(): string | null {
  try {
    let v = localStorage.getItem(CHAVE_VISITANTE);
    if (!v) {
      v = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(CHAVE_VISITANTE, v);
    }
    return v;
  } catch {
    return null; // sem armazenamento (aba anônima bloqueada): não conta
  }
}

function eEquipe(): boolean {
  try {
    if (localStorage.getItem(CHAVE_EQUIPE) === "1") return true;
  } catch {
    /* segue */
  }
  return document.cookie.split("; ").includes("tecpro_modo_aluno=1");
}

export function SinalOnline() {
  const pathname = usePathname();
  const ultimo = useRef(0);

  useEffect(() => {
    if (!lugarDoCaminho(pathname)) return;
    if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return;
    const enviar = () => {
      if (document.visibilityState !== "visible" || eEquipe()) return;
      const v = visitante();
      if (!v) return;
      ultimo.current = Date.now();
      fetch("/api/online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ v, c: window.location.pathname }),
        keepalive: true,
      }).catch(() => undefined);
    };
    enviar();
    const t = setInterval(enviar, INTERVALO_SINAL_MS);
    // Voltou para a aba depois de um tempo: avisa na hora, sem esperar o próximo minuto.
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimo.current > INTERVALO_SINAL_MS / 2) enviar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [pathname]);

  return null;
}
