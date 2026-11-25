"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Vídeo de parabéns na última aula. Na primeira vez que aparece (logo depois de concluir o curso),
 * rola a tela até ele e dá o play sozinho, tentando com som. Se o navegador não deixar tocar com som,
 * toca sem som e mostra o botão "Ativar som".
 */
export function VideoParabens({ src, capa, chave }: { src: string; capa?: string; chave: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [mudo, setMudo] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const k = `tecpro_parabens_${chave}`;
    let jaViu = false;
    try {
      jaViu = localStorage.getItem(k) === "1";
      localStorage.setItem(k, "1");
    } catch {
      /* navegador sem armazenamento: toca sempre */
    }
    if (jaViu) return;
    caixa.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      setMudo(true);
      v.play().catch(() => setMudo(false));
    });
  }, [chave]);

  const ativarSom = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    if (v.currentTime > 1 && v.currentTime < 3) v.currentTime = 0;
    void v.play();
    setMudo(false);
  };

  return (
    <div ref={caixa} className="relative mt-4 aspect-video overflow-hidden rounded-3xl bg-marca-950">
      <video ref={ref} src={src} poster={capa} controls playsInline preload="metadata" className="h-full w-full" onVolumeChange={(e) => !e.currentTarget.muted && setMudo(false)} />
      {mudo && (
        <button
          type="button"
          onClick={ativarSom}
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-laranja-500 px-5 py-2.5 text-sm font-bold text-marca-900 shadow-lg hover:bg-laranja-400"
        >
          🔊 Ativar som
        </button>
      )}
    </div>
  );
}
