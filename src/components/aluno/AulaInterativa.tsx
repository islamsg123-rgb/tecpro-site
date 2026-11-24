"use client";

import { useEffect, useRef, useState } from "react";
import { alternarAula, iniciarAula, registrarVideo } from "@/app/minha-conta/acoes";
import type { PerguntaPublica } from "@/lib/provas";
import { IconeCadeado, IconeCheck, IconePlay } from "@/components/Icones";
import { ProvaAula } from "./ProvaAula";

type Tipo = "panda" | "outro" | "nenhum";

interface Props {
  slug: string;
  aulaId: string;
  titulo: string;
  embed: string | null;
  tipo: Tipo;
  feita: boolean;
  videoOk: boolean;
  provaOk: boolean;
  faltamSegundos: number;
  proximaId: string | null;
  perguntas: PerguntaPublica[];
  apostila: string | null;
}

const MINIMO = 0.8;

/** Mede quanto do vídeo do Panda foi assistido (segundos diferentes vistos, sem contar os pulos). */
function useVideoPanda(ativo: boolean, aoAtingir: (assistido: number, duracao: number) => void) {
  const [pct, setPct] = useState<number | null>(null);
  const ref = useRef({ vistos: new Set<number>(), ultimo: null as number | null, max: 0, duracao: 0, enviado: false });
  const cb = useRef(aoAtingir);
  cb.current = aoAtingir;

  useEffect(() => {
    if (!ativo) return;
    const s = ref.current;
    function ouvir(ev: MessageEvent) {
      let host = "";
      try { host = new URL(ev.origin).hostname; } catch { return; }
      if (!host.endsWith(".pandavideo.com.br")) return;
      let d: unknown = ev.data;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
      if (!d || typeof d !== "object") return;
      const m = d as Record<string, unknown>;
      const msg = String(m.message ?? "");
      const t = Number(m.currentTime);
      // O Panda não manda a duração no panda_timeupdate; ela vem no panda_allData (playerData.duration).
      const pd = (m.playerData && typeof m.playerData === "object" ? m.playerData : {}) as Record<string, unknown>;
      const du = Number(m.duration ?? m.videoDuration ?? pd.duration ?? 0);
      if (du > 0) s.duracao = du;
      if (msg === "panda_allData") {
        if (!(du > 0)) return;
      } else if (msg === "panda_timeupdate" && Number.isFinite(t)) {
        if (s.ultimo !== null && t > s.ultimo && t - s.ultimo <= 3) {
          for (let x = Math.floor(s.ultimo); x < Math.floor(t); x++) s.vistos.add(x);
        }
        s.ultimo = t;
        s.max = Math.max(s.max, t);
      } else if (msg === "panda_seeking" || msg === "panda_seeked") {
        s.ultimo = Number.isFinite(t) ? t : null;
      } else if (msg === "panda_ended") {
        if (s.ultimo !== null && Number.isFinite(t)) for (let x = Math.floor(s.ultimo); x < Math.floor(t); x++) s.vistos.add(x);
        if (!s.duracao) s.duracao = Math.max(s.max, Number.isFinite(t) ? t : 0);
      } else {
        return;
      }
      const assistido = s.vistos.size;
      if (s.duracao > 0) {
        setPct(Math.min(100, Math.round((assistido / s.duracao) * 100)));
        if (!s.enviado && assistido >= MINIMO * s.duracao) {
          s.enviado = true;
          cb.current(assistido, s.duracao);
        }
      }
    }
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [ativo]);

  return { pct, reabrir: () => { ref.current.enviado = false; } };
}

export function AulaInterativa(p: Props) {
  const [videoOk, setVideoOk] = useState(p.videoOk);
  const [provaOk, setProvaOk] = useState(p.provaOk);
  const [faltam, setFaltam] = useState(p.faltamSegundos);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => { iniciarAula(p.slug, p.aulaId).catch(() => {}); }, [p.slug, p.aulaId]);

  const video = useVideoPanda(p.tipo === "panda" && !videoOk && !p.feita, (assistido, duracao) => {
    registrarVideo(p.slug, p.aulaId, assistido, duracao)
      .then((ok) => {
        if (ok) setVideoOk(true);
        else { setAviso("Não conseguimos confirmar que você assistiu ao vídeo. Continue assistindo."); video.reabrir(); }
      })
      .catch(() => video.reabrir());
  });

  // Drive / Slides: o player não informa o tempo; exigimos um tempo mínimo na aula.
  useEffect(() => {
    if (p.tipo !== "outro" || videoOk || p.feita) return;
    if (faltam <= 0) { setVideoOk(true); return; }
    const t = setTimeout(() => setFaltam((f) => f - 1), 1000);
    return () => clearTimeout(t);
  }, [p.tipo, videoOk, faltam, p.feita]);

  const pronto = p.feita || (videoOk && provaOk);
  const pendencias: string[] = [];
  if (!p.feita && !videoOk) {
    if (p.tipo === "panda") pendencias.push(video.pct === null ? "Assista a pelo menos 80% do vídeo" : `Assista a pelo menos 80% do vídeo (você viu ${video.pct}%)`);
    if (p.tipo === "outro") pendencias.push(`Acompanhe o conteúdo da aula (libera em ${Math.floor(faltam / 60)}:${String(faltam % 60).padStart(2, "0")})`);
  }
  if (!p.feita && !provaOk) pendencias.push("Acerte todas as questões da prova");

  return (
    <>
      {p.embed ? (
        <div className="mt-4 aspect-video overflow-hidden rounded-3xl bg-marca-950">
          <iframe
            src={p.embed}
            title={p.titulo}
            className="h-full w-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="relative mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-3xl bg-marca-950 text-center text-white">
          <div className="fundo-grade absolute inset-0" />
          <div className="relative px-6">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-laranja-500"><IconePlay className="h-8 w-8" /></span>
            <p className="mt-4 font-semibold">Esta aula não tem vídeo</p>
          </div>
        </div>
      )}

      {children(p, pronto, pendencias, aviso)}

      {p.perguntas.length > 0 && (
        <ProvaAula
          key={p.aulaId}
          slug={p.slug}
          aulaId={p.aulaId}
          perguntas={p.perguntas}
          jaAprovado={provaOk && !p.feita ? true : p.feita}
          onAprovado={() => setProvaOk(true)}
        />
      )}
    </>
  );
}

function children(p: Props, pronto: boolean, pendencias: string[], aviso: string | null) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {p.feita ? (
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-green-600 px-6 py-3 font-bold text-green-700">
          <IconeCheck className="h-5 w-5" /> Aula concluída
        </span>
      ) : (
        <form action={alternarAula}>
          <input type="hidden" name="slug" value={p.slug} />
          <input type="hidden" name="aulaId" value={p.aulaId} />
          {p.proximaId && <input type="hidden" name="irPara" value={p.proximaId} />}
          <button
            disabled={!pronto}
            className="inline-flex items-center gap-2 rounded-full bg-laranja-500 px-6 py-3 font-bold text-marca-900 transition hover:bg-laranja-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {pronto ? <IconeCheck className="h-5 w-5" /> : <IconeCadeado className="h-5 w-5" />}
            {p.proximaId ? "Concluir e ir para a próxima" : "Concluir aula"}
          </button>
        </form>
      )}
      {p.apostila && (
        <a href={p.apostila} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border-2 border-marca-900 px-5 py-2.5 text-sm font-bold text-marca-900 hover:bg-marca-50">
          Baixar apostila (PDF)
        </a>
      )}
      {!p.feita && pendencias.length > 0 && (
        <ul className="w-full space-y-1 text-sm text-slate-600">
          {pendencias.map((t) => (
            <li key={t} className="flex items-center gap-2"><IconeCadeado className="h-4 w-4 text-laranja-600" /> {t}</li>
          ))}
        </ul>
      )}
      {aviso && <p className="w-full text-sm text-amber-700">{aviso}</p>}
    </div>
  );
}
