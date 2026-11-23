import type { Metadata } from "next";
import { listarCobrancas } from "@/lib/pagamentos";
import { TabelaVendas } from "@/components/admin/TabelaVendas";

export const metadata: Metadata = { title: "Vendas" };

export default async function Vendas() {
  const vendas = await listarCobrancas();
  return (
    <>
      <h1 className="text-3xl font-extrabold text-marca-900">Vendas</h1>
      <p className="mt-2 text-sm text-slate-500">As 50 cobranças mais recentes do Asaas. Para estornos e relatórios completos, use o painel do Asaas.</p>
      <div className="mt-6"><TabelaVendas vendas={vendas} /></div>
    </>
  );
}
