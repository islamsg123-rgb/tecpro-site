import Link from "next/link";
import { exigirAluno } from "@/lib/area-aluno";
import { loginEmDemonstracao, mostrarAvisoSenha } from "@/lib/auth";
import { AvisoCriarSenha } from "@/components/aluno/AvisoCriarSenha";
import { eAdmin } from "@/lib/admin";
import { sair } from "../entrar/acoes";

export const dynamic = "force-dynamic";

export default async function LayoutAluno({ children }: { children: React.ReactNode }) {
  const aluno = await exigirAluno();
  const temPainel = await eAdmin().catch(() => false);
  const avisoSenha = await mostrarAvisoSenha(aluno);
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f3f6fb]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <nav className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto whitespace-nowrap text-sm font-semibold">
            <Link href="/minha-conta" className="rounded-full px-4 py-2 text-marca-900 hover:bg-marca-50">Meus cursos</Link>
            <Link href="/cursos" className="rounded-full px-4 py-2 text-slate-500 hover:bg-marca-50 hover:text-marca-900">Novos cursos</Link>
            <Link href="/minha-conta/senha" className="rounded-full px-4 py-2 text-slate-500 hover:bg-marca-50 hover:text-marca-900">Minha senha</Link>
            {temPainel && <Link href="/admin" className="rounded-full bg-marca-900 px-4 py-2 text-white hover:bg-marca-800">Painel</Link>}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-[220px] truncate text-slate-500 sm:inline">{aluno.email}</span>
            {loginEmDemonstracao && <span className="rounded-full bg-laranja-300/40 px-2.5 py-1 text-xs font-semibold text-marca-900">demonstração</span>}
            <form action={sair}>
              <button className="rounded-full border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:border-marca-900 hover:text-marca-900">Sair</button>
            </form>
          </div>
        </div>
      </div>
      {avisoSenha && <AvisoCriarSenha />}
      {children}
    </div>
  );
}
