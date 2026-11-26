"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { lugarDoCaminho } from "@/lib/online";
import { dadosVitrine } from "@/lib/vitrine-navegador";
import type { AvisoLoja } from "@/lib/dados/avisos-loja";

/**
 * Avisos no canto da loja com acontecimentos REAIS dos últimos dias
 * ("Leonardo, de Belém (PA), se inscreveu em Informática Essencial · há 4 min").
 * O primeiro aparece depois de 10 segundos, os outros a cada 35 segundos, no máximo 5 por visita.
 * Só na página inicial, no catálogo e na página do curso (nunca no pagamento nem na área do aluno).
 * Liga/desliga em Configurações da loja.
 */

const PRIMEIRO = 10_000;
const ENTRE = 35_000;
const NA_TELA = 6_500;
const MAXIMO = 5;
const CHAVE = "tecpro:avisos"; // por visita (aba): quantos já apareceram ou se a pessoa fechou

function lerEstado(): { vistos: number; fechado: boolean } {
  try {
    return { vistos: 0, fechado: false, ...JSON.parse(sessionStorage.getItem(CHAVE) ?? "{}") };
  } catch {
    return { vistos: 0, fechado: false };
  }
}
function gravarEstado(e: { vistos: number; fechado: boolean }) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* sem armazenamento: vale só nesta página */
  }
}

function quando(iso: string): string {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return min === 1 ? "há 1 minuto" : `há ${min} minutos`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "há 1 hora" : `há ${h} horas`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

const podeMostrar = (pathname: string) => {
  const l = lugarDoCaminho(pathname);
  return Boolean(l && l.area === "loja" && (l.pagina === "inicio" || l.pagina === "catalogo" || l.pagina === "curso"));
};

export function AvisosLoja() {
  const pathname = usePathname();
  const [avisos, setAvisos] = useState<AvisoLoja[]>([]);
  const [atual, setAtual] = useState<AvisoLoja | null>(null);
  const [visivel, setVisivel] = useState(false);
  const caminho = useRef(pathname);
  caminho.current = pathname;

  useEffect(() => {
    dadosVitrine().then((d) => setAvisos(d?.avisos ?? []));
  }, []);

  useEffect(() => {
    if (!avisos.length) return;
    let t: ReturnType<typeof setTimeout>;
    let some: ReturnType<typeof setTimeout>;
    const mostrar = () => {
      const e = lerEstado();
      if (e.fechado || e.vistos >= MAXIMO) return;
      if (podeMostrar(caminho.current) && document.visibilityState === "visible") {
        setAtual(avisos[e.vistos % avisos.length]);
        setVisivel(true);
        gravarEstado({ ...e, vistos: e.vistos + 1 });
        some = setTimeout(() => setVisivel(false), NA_TELA);
      }
      t = setTimeout(mostrar, ENTRE);
    };
    t = setTimeout(mostrar, PRIMEIRO);
    return () => {
      clearTimeout(t);
      clearTimeout(some);
    };
  }, [avisos]);

  // Saiu da loja (foi para o pagamento, por exemplo): o aviso some na hora.
  useEffect(() => {
    if (!podeMostrar(pathname)) setVisivel(false);
  }, [pathname]);

  if (!atual) return null;
  const barraDeCompra = /^\/cursos\/[^/]+$/.test(pathname);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-3 right-20 z-30 transition-all duration-500 print:hidden sm:left-5 sm:right-auto sm:w-[340px] ${barraDeCompra ? "bottom-24 lg:bottom-5" : "bottom-4 sm:bottom-5"} ${visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
    >
      <div className="relative flex items-start gap-3 rounded-2xl bg-white p-3 pr-8 shadow-2xl ring-1 ring-slate-200">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-bold ${atual.tipo === "certificado" ? "bg-laranja-500 text-marca-900" : "bg-marca-900 text-white"}`} aria-hidden>
          {atual.tipo === "certificado" ? "🎓" : atual.nome.charAt(0)}
        </span>
        <span className="min-w-0 text-[13px] leading-snug text-slate-600">
          <strong className="text-marca-900">{atual.nome}</strong>
          {atual.local && <>, de {atual.local},</>}{" "}
          {atual.tipo === "certificado" ? (
            <>concluiu <strong className="text-marca-900">{atual.curso}</strong> e emitiu o certificado</>
          ) : (
            <>se inscreveu em <strong className="text-marca-900">{atual.curso}</strong></>
          )}
          <span className="mt-0.5 block text-xs text-slate-400">{quando(atual.em)}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setVisivel(false);
            gravarEstado({ ...lerEstado(), fechado: true });
          }}
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Fechar avisos"
        >
          ×
        </button>
      </div>
    </div>
  );
}
