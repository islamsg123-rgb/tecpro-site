import Link from "next/link";
import type { Curso } from "@/lib/types";
import { CapaCurso } from "./CapaCurso";
import { precoDoCurso } from "@/lib/formatar";
import { IconeCertificado, IconeRelogio, IconeSeta } from "./Icones";

export function CartaoCurso({ curso }: { curso: Curso }) {
  return (
    <Link
      href={`/cursos/${curso.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-laranja-500/40 hover:shadow-2xl hover:shadow-marca-900/10"
    >
      <div className="overflow-hidden">
        <CapaCurso curso={curso} comTitulo={false} className="transition duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <span className="w-fit rounded-full bg-marca-50 px-3 py-1 text-xs font-semibold text-marca-700">
          {curso.categoria}
        </span>
        <h3 className="mt-3 text-lg font-bold leading-snug text-marca-900">{curso.nome}</h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-500">{curso.resumo}</p>
        <div className="mt-4 flex gap-4 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5"><IconeRelogio className="h-4 w-4" /> {curso.cargaHoraria}h</span>
          <span className="flex items-center gap-1.5"><IconeCertificado className="h-4 w-4" /> Certificado</span>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-5">
          <span className="font-display text-2xl font-bold text-marca-900">{precoDoCurso(curso)}</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-marca-900 text-white transition group-hover:bg-laranja-500 group-hover:text-marca-900">
            <IconeSeta className="h-5 w-5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
