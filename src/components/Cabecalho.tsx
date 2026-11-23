import Link from "next/link";
import { Logo } from "./Logo";
import { IconeMenu } from "./Icones";

const links = [
  { href: "/cursos", rotulo: "Cursos" },
  { href: "/#como-funciona", rotulo: "Como funciona" },
  { href: "/#certificado", rotulo: "Certificado" },
  { href: "/#duvidas", rotulo: "Dúvidas" },
];

export function Cabecalho() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-marca-900/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Tecpro Multi Ensino, página inicial" className="shrink-0">
          <Logo altura={40} />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-white">
              {l.rotulo}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/minha-conta"
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Área do aluno
          </Link>
          <Link
            href="/cursos"
            className="rounded-full bg-laranja-500 px-5 py-2.5 text-sm font-bold text-marca-900 shadow-lg shadow-laranja-500/20 transition hover:bg-laranja-400"
          >
            Ver cursos
          </Link>
        </div>

        {/* Menu do celular (funciona sem JavaScript) */}
        <details className="relative md:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-white hover:bg-white/10" aria-label="Abrir menu">
            <IconeMenu />
          </summary>
          <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-white/10 bg-marca-800 p-2 shadow-2xl">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">
                {l.rotulo}
              </Link>
            ))}
            <Link href="/minha-conta" className="mt-1 block rounded-xl bg-laranja-500 px-4 py-3 text-center text-sm font-bold text-marca-900">
              Área do aluno
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
