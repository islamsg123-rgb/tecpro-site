"use client";

import type { RespostaVitrine } from "@/app/api/vitrine/route";

/** Busca /api/vitrine uma vez por visita (o Google Analytics e os avisos usam a mesma resposta). */
let pedido: Promise<RespostaVitrine | null> | null = null;
export function dadosVitrine(): Promise<RespostaVitrine | null> {
  pedido ??= fetch("/api/vitrine").then((r) => (r.ok ? (r.json() as Promise<RespostaVitrine>) : null)).catch(() => null);
  return pedido;
}
