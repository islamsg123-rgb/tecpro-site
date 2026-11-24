import type { Metadata } from "next";
import Link from "next/link";
import { acessoPainel, exigirAdmin } from "@/lib/admin";
import { bancoEmDemonstracao } from "@/lib/dados";
import { pagamentoEmSimulacao } from "@/lib/pagamentos";
import { usandoDadosDeExemplo } from "@/lib/escola-avancada/client";
import { AbasSecao, MenuLateral, type Contadores } from "@/components/admin/MenuLateral";
import { contarNovas } from "@/lib/dados/mensagens";
import { sair } from "../entrar/acoes";

export const metadata: Metadata = { title: { default: "Painel", template: "%s | Painel Tecpro" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  const acesso = (await acessoPainel())!;
  const secoes = ["painel", ...acesso.permissoes, ...(acesso.dono ? ["sistema"] : [])] as Parameters<typeof MenuLateral>[0]["secoes"];
  // Mensagens novas do botão de ajuda (número vermelho no menu).
  const contadores: Contadores = {};
  if (acesso.permissoes.includes("mensagens")) {
    const novas = await contarNovas().catch(() => ({ aluno: 0, loja: 0 }));
    contadores["/admin/mensagens/aluno"] = novas.aluno;
    contadores["/admin/mensagens/loja"] = novas.loja;
  }
  const avisos = [
    usandoDadosDeExemplo && "cursos de exemplo (falta a chave da Escola Avançada)",
    pagamentoEmSimulacao && "pagamentos simulados (falta a chave do Mercado Pago ou do Asaas)",
    bancoEmDemonstracao && "banco de demonstração (falta o Supabase): as alterações somem quando o servidor reinicia",
  ].filter(Boolean);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f3f6fb] md:flex">
      <MenuLateral
        secoes={secoes}
        contadores={contadores}
        email={acesso.nome ? `${acesso.nome} · ${acesso.email}` : acesso.email}
        sair={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/minha-conta/senha" className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white hover:border-laranja-500">Minha senha</Link>
            <form action={sair}>
              <button className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white hover:border-laranja-500">Sair</button>
            </form>
          </div>
        }
      />
      <div className="min-w-0 flex-1">
        {avisos.length > 0 && (
          <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
            <p className="rounded-2xl border border-laranja-500/40 bg-laranja-300/20 p-4 text-sm text-marca-900">
              <strong>Modo de teste:</strong> {avisos.join("; ")}.
            </p>
          </div>
        )}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <AbasSecao secoes={secoes} contadores={contadores} />
          {children}
        </div>
      </div>
    </div>
  );
}
