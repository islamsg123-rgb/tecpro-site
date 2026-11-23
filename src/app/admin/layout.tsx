import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { bancoEmDemonstracao } from "@/lib/dados";
import { pagamentoEmSimulacao } from "@/lib/pagamentos";
import { usandoDadosDeExemplo } from "@/lib/escola-avancada/client";
import { sair } from "../entrar/acoes";

export const metadata: Metadata = { title: { default: "Painel", template: "%s | Painel Tecpro" }, robots: { index: false } };
export const dynamic = "force-dynamic";

const menu = [
  { href: "/admin", rotulo: "Visão geral" },
  { href: "/admin/cursos", rotulo: "Cursos" },
  { href: "/admin/vendas", rotulo: "Vendas" },
  { href: "/admin/carrinhos", rotulo: "Carrinhos" },
  { href: "/admin/cupons", rotulo: "Cupons" },
  { href: "/admin/alunos", rotulo: "Alunos" },
  { href: "/admin/certificados", rotulo: "Certificados" },
  { href: "/admin/configuracoes", rotulo: "Configurações" },
  { href: "/admin/diagnostico", rotulo: "API" },
];

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin();
  const avisos = [
    usandoDadosDeExemplo && "cursos de exemplo (falta a chave da Escola Avançada)",
    pagamentoEmSimulacao && "pagamentos simulados (falta a chave do Asaas)",
    bancoEmDemonstracao && "banco de demonstração (falta o Supabase): as alterações somem quando o servidor reinicia",
  ].filter(Boolean);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f3f6fb]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="rounded-lg bg-marca-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-laranja-500">Painel</span>
            <nav className="flex flex-wrap gap-1 text-sm font-semibold">
              {menu.map((m) => (
                <Link key={m.href} href={m.href} className="rounded-full px-4 py-2 text-slate-600 hover:bg-marca-50 hover:text-marca-900">
                  {m.rotulo}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{admin.email}</span>
            <form action={sair}>
              <button className="rounded-full border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:border-marca-900">Sair</button>
            </form>
          </div>
        </div>
      </div>
      {avisos.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <p className="rounded-2xl border border-laranja-500/40 bg-laranja-300/20 p-4 text-sm text-marca-900">
            <strong>Modo de teste:</strong> {avisos.join("; ")}.
          </p>
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
