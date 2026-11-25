"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatarPreco } from "@/lib/formatar";

/**
 * Aviso de nova venda no painel: com o painel aberto, toca um "plim" e mostra
 * "Nova venda: R$ 37,90, Maria". Funciona nas duas áreas (Gestão e Financeiro).
 *
 * O painel pergunta ao site a cada 15 segundos (1 minuto com a aba escondida) se entrou venda nova.
 * Os navegadores só deixam tocar som depois do primeiro clique na página; até lá, o botão pede um clique.
 * Ligado/desligado fica guardado neste navegador.
 */

interface Venda {
  cobrancaId: string;
  valorCentavos: number | null;
  nome: string;
  item: string;
  em: string;
}

const INTERVALO = 15_000;
const INTERVALO_ESCONDIDA = 60_000;
/** Cada pergunta olha um pouco para trás (vendas gravadas no meio da pergunta anterior); repetidas são ignoradas. */
const SOBREPOSICAO = 60_000;
const CHAVE_SOM = "tecpro:som-venda";

function lerSom(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== "0";
  } catch {
    return true;
  }
}

function gravarSom(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_SOM, ligado ? "1" : "0");
  } catch {
    /* navegador sem armazenamento: vale só nesta visita */
  }
}

/** "Plim": duas notas curtas, feitas pelo próprio navegador (sem arquivo de áudio). */
function tocarPlim(ctx: AudioContext) {
  const t0 = ctx.currentTime + 0.02;
  const notas: [number, number][] = [[1318.5, 0], [1760, 0.12]]; // Mi e Lá agudos
  for (const [freq, atraso] of notas) {
    for (const [tipo, volume] of [["sine", 0.35], ["triangle", 0.08]] as const) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = tipo;
      osc.frequency.value = freq;
      const t = t0 + atraso;
      ganho.gain.setValueAtTime(0.0001, t);
      ganho.gain.exponentialRampToValueAtTime(volume, t + 0.01);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1);
    }
  }
}

export function AvisoVendas() {
  const [som, setSom] = useState(true);
  const [liberado, setLiberado] = useState(false); // o navegador já deixou tocar som?
  const [avisos, setAvisos] = useState<Venda[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const somRef = useRef(true);
  const vistas = useRef(new Set<string>());
  const desde = useRef<string | null>(null);
  const inicio = useRef<string | null>(null);
  const tituloOriginal = useRef<string>("");
  const naoVistas = useRef(0);

  useEffect(() => {
    const v = lerSom();
    setSom(v);
    somRef.current = v;
  }, []);

  /** Cria/acorda o som. Só funciona dentro de um clique (regra dos navegadores). */
  const acordarSom = useCallback(() => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      audio.current ??= new AC();
      const ctx = audio.current;
      const pronto = () => setLiberado(ctx.state === "running");
      if (ctx.state === "suspended") ctx.resume().then(pronto).catch(() => {});
      else pronto();
    } catch {
      /* sem som neste navegador */
    }
  }, []);

  // Primeiro clique ou tecla em qualquer lugar do painel libera o som.
  useEffect(() => {
    if (liberado) return;
    const libera = () => acordarSom();
    document.addEventListener("pointerdown", libera, true);
    document.addEventListener("keydown", libera, true);
    return () => {
      document.removeEventListener("pointerdown", libera, true);
      document.removeEventListener("keydown", libera, true);
    };
  }, [liberado, acordarSom]);

  const plim = useCallback(() => {
    const ctx = audio.current;
    if (!somRef.current || !ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    tocarPlim(ctx);
  }, []);

  const fechar = (id: string) => setAvisos((l) => l.filter((a) => a.cobrancaId !== id));

  // Pergunta ao site se entrou venda nova.
  useEffect(() => {
    let parado = false;
    let espera: ReturnType<typeof setTimeout>;

    async function perguntar() {
      try {
        const q = desde.current ? `?desde=${encodeURIComponent(new Date(Date.parse(desde.current) - SOBREPOSICAO).toISOString())}` : "";
        const r = await fetch(`/api/admin/vendas-novas${q}`, { cache: "no-store" });
        if (r.ok) {
          const { agora, vendas } = (await r.json()) as { agora: string; vendas: Venda[] };
          inicio.current ??= agora;
          desde.current = agora;
          // Só o que é novo de verdade: não repete e não mostra vendas de antes de abrir o painel.
          const novas = vendas.filter((v) => !vistas.current.has(v.cobrancaId) && v.em >= inicio.current!);
          vendas.forEach((v) => vistas.current.add(v.cobrancaId));
          if (novas.length && !parado) {
            setAvisos((l) => [...novas.reverse(), ...l].slice(0, 3));
            plim();
            if (document.hidden) {
              naoVistas.current += novas.length;
              if (!tituloOriginal.current) tituloOriginal.current = document.title;
              document.title = `(${naoVistas.current}) Nova venda! · ${tituloOriginal.current}`;
            }
          }
        }
      } catch {
        /* sem internet: tenta de novo na próxima */
      }
      if (!parado) espera = setTimeout(perguntar, document.hidden ? INTERVALO_ESCONDIDA : INTERVALO);
    }

    // Ao voltar para a aba: tira o "(1) Nova venda!" do título e pergunta na hora.
    const aoVoltar = () => {
      if (document.hidden) return;
      if (tituloOriginal.current) document.title = tituloOriginal.current;
      tituloOriginal.current = "";
      naoVistas.current = 0;
      clearTimeout(espera);
      perguntar();
    };

    perguntar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      parado = true;
      clearTimeout(espera);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [plim]);

  // Cada aviso some sozinho depois de 30 segundos.
  useEffect(() => {
    if (!avisos.length) return;
    const t = setTimeout(() => setAvisos((l) => l.slice(0, -1)), 30_000);
    return () => clearTimeout(t);
  }, [avisos]);

  const alternar = () => {
    const v = !som;
    setSom(v);
    somRef.current = v;
    gravarSom(v);
    acordarSom();
    if (v) setTimeout(plim, 50); // toca uma vez para a pessoa ouvir como é
  };

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        aria-pressed={som}
        title={
          !som ? "Som de nova venda desligado. Clique para ligar."
          : liberado ? "Toca um som quando entra uma venda. Clique para desligar."
          : "O navegador só libera o som depois do primeiro clique na página. Clique em qualquer lugar."
        }
        className={`relative flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${som ? "border-white/25 text-white hover:bg-white/10" : "border-white/15 text-white/50 hover:text-white"}`}
      >
        <span aria-hidden>{som ? "🔔" : "🔕"}</span>
        <span className="hidden lg:inline">Som de venda: {som ? "ligado" : "desligado"}</span>
        {som && !liberado && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-amber-400 ring-2 ring-neutral-950" aria-label="clique na página para liberar o som" />
        )}
      </button>

      {/* Avisos de venda, no canto da tela */}
      <div aria-live="polite" className="pointer-events-none fixed right-4 top-20 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 print:hidden">
        {avisos.map((v) => (
          <div key={v.cobrancaId} role="status" className="aviso-venda pointer-events-auto overflow-hidden rounded-2xl border-l-8 border-laranja-500 bg-white p-4 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-laranja-500 text-2xl" aria-hidden>💰</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-laranja-600">Nova venda!</p>
                <p className="text-lg font-extrabold text-marca-900">
                  {v.valorCentavos != null ? formatarPreco(v.valorCentavos) : "Pagamento confirmado"}, {v.nome}
                </p>
                <p className="truncate text-sm text-slate-600">{v.item}</p>
                <Link href="/admin/financeiro/recebimentos" onClick={() => fechar(v.cobrancaId)} className="mt-1 inline-block text-sm font-semibold text-marca-700 underline hover:text-laranja-600">
                  Ver vendas
                </Link>
              </div>
              <button type="button" onClick={() => fechar(v.cobrancaId)} aria-label="Fechar aviso" className="rounded-full px-2 text-xl leading-none text-slate-400 hover:text-marca-900">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
