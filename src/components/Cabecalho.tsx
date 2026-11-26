import Link from "next/link";
import { LogoComParceiro } from "./LogoComParceiro";
import { MenuCelular } from "./MenuCelular";

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
        <Link href="/" aria-label="Tecpro Multi Ensino e Programa Forma Brasil, página inicial" className="shrink-0">
          <LogoComParceiro />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 lg:flex xl:gap-8">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-white">
              {l.rotulo}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
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

        {/* Menu do celular: fecha ao tocar fora, num link, ao trocar de página ou com Esc */}
        <MenuCelular links={links} />
      </div>
    </header>
  );
}
