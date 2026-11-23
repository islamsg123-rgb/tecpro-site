import type { Metadata } from "next";
import { getCursosPublicos } from "@/lib/cursos";
import { Catalogo } from "@/components/Catalogo";

export const metadata: Metadata = { title: "Cursos" };

type Props = { searchParams: Promise<{ busca?: string; categoria?: string }> };

export default async function PaginaCursos({ searchParams }: Props) {
  const [cursos, sp] = await Promise.all([getCursosPublicos(), searchParams]);
  return (
    <>
      <section className="relative overflow-hidden bg-marca-900 text-white">
        <div className="fundo-grade absolute inset-0" />
        <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full bg-laranja-500/20 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-widest text-laranja-500">Catálogo</p>
          <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">Todos os cursos</h1>
          <p className="mt-3 max-w-xl text-lg text-slate-300">Escolha o curso ideal para você e comece hoje mesmo.</p>
        </div>
      </section>
      <section className="relative mx-auto -mt-14 max-w-7xl px-4 pb-24 sm:px-6">
        <Catalogo cursos={cursos} buscaInicial={sp.busca ?? ""} categoriaInicial={sp.categoria ?? "Todas"} />
      </section>
    </>
  );
}
