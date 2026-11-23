import Link from "next/link";
import { getCursos } from "@/lib/cursos";
import { contagens } from "@/lib/dados";
import { formatarPreco } from "@/lib/formatar";
import { listarCobrancas } from "@/lib/pagamentos";
import { TabelaVendas } from "@/components/admin/TabelaVendas";
import { IconeSeta } from "@/components/Icones";

export default async function VisaoGeral() {
  const [vendas, cursos, totais] = await Promise.all([listarCobrancas(), getCursos(), contagens()]);
  const pagas = vendas.filter((v) => v.situacao === "pago");
  const cards = [
    { rotulo: "Recebido (últimas vendas)", valor: formatarPreco(pagas.reduce((s, v) => s + v.valorCentavos, 0)), detalhe: `${pagas.length} pagamentos` },
    { rotulo: "Aguardando pagamento", valor: String(vendas.filter((v) => v.situacao === "aguardando").length), detalhe: "Pix e boletos em aberto" },
    { rotulo: "Alunos", valor: String(totais.alunos), detalhe: "com compra pelo site" },
    { rotulo: "Cursos na vitrine", valor: `${cursos.filter((c) => c.visivel).length} de ${cursos.length}`, detalhe: `${totais.certificados} certificados emitidos` },
  ];

  return (
    <>
      <h1 className="text-3xl font-extrabold text-marca-900">Visão geral</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.rotulo} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{c.rotulo}</p>
            <p className="mt-2 font-display text-3xl font-bold text-marca-900">{c.valor}</p>
            <p className="mt-1 text-xs text-slate-500">{c.detalhe}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex items-end justify-between">
        <h2 className="text-xl font-bold text-marca-900">Vendas recentes</h2>
        <Link href="/admin/vendas" className="flex items-center gap-1 text-sm font-semibold text-marca-700 hover:text-laranja-600">
          Ver todas <IconeSeta className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4"><TabelaVendas vendas={vendas.slice(0, 5)} /></div>
    </>
  );
}
