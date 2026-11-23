import type { Curso } from "@/lib/types";
import { IconeCategoria } from "./Icones";

/** Capa do curso. Se a API não mandar imagem, desenha uma capa no padrão visual da Tecpro. */
export function CapaCurso({ curso, className = "", comTitulo = true }: { curso: Curso; className?: string; comTitulo?: boolean }) {
  if (curso.capaUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={curso.capaUrl} alt={`Capa do curso ${curso.nome}`} className={`aspect-[16/10] w-full object-cover ${className}`} />
    );
  }
  return (
    <div className={`relative aspect-[16/10] w-full overflow-hidden bg-marca-900 ${className}`} aria-hidden>
      <div className="fundo-grade absolute inset-0" />
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-laranja-500/30 blur-3xl" />
      <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-marca-500/40 blur-3xl" />
      <IconeCategoria categoria={curso.categoria} className="absolute -bottom-4 -right-4 h-36 w-36 text-white/[0.07]" />
      <div className="relative flex h-full flex-col justify-between p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-laranja-500 text-marca-900">
          <IconeCategoria categoria={curso.categoria} className="h-6 w-6" />
        </span>
        {comTitulo ? (
          <span className="font-display text-xl font-bold leading-tight text-white">{curso.nome}</span>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{curso.categoria} · {curso.cargaHoraria}h</span>
        )}
      </div>
    </div>
  );
}
