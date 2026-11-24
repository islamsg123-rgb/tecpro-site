import type { Metadata } from "next";
import { acessoPainel, exigirAdmin } from "@/lib/admin";
import { bancoEmDemonstracao } from "@/lib/dados";
import { pagamentoEmSimulacao } from "@/lib/pagamentos";
import { usandoDadosDeExemplo } from "@/lib/escola-avancada/client";
import { AbasSecao, MenuLateral } from "@/components/admin/MenuLateral";
import { sair } from "../entrar/acoes";

export const metadata: Metadata = { title: { default: "Painel", template: "%s | Painel Tecpro" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  const acesso = (await acessoPainel())!;
  const secoes = ["painel", ...acesso.permissoes, ...(acesso.dono ? ["sistema"] : [])] as Parameters<typeof MenuLateral>[0]["secoes"];
  const avisos = [
    usandoDadosDeExemplo && "cursos de exemplo (falta a chave da Escola Avançada)",
    pagamentoEmSimulacao && "pagamentos simulados (falta a chave do Mercado Pago ou do Asaas)",
    bancoEmDemonstracao && "banco de demonstração (falta o Supabase): as alterações somem quando o servidor reinicia",
  ].filter(Boolean);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f3f6fb] md:flex">
      <MenuLateral
        secoes={secoes}
        email={acesso.nome ? `${acesso.nome} · ${acesso.email}` : acesso.email}
        sair={
          <form action={sair}>
            <button className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white hover:border-laranja-500">Sair</button>
          </form>
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
          <AbasSecao secoes={secoes} />
          {children}
        </div>
      </div>
    </div>
  );
}
