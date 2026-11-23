/** Link para baixar a planilha (abre no Excel). */
export function BotaoExportar({ tipo }: { tipo: "alunos" | "vendas" | "certificados" }) {
  return (
    <a
      href={`/admin/exportar/${tipo}`}
      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-marca-900 hover:border-marca-900"
    >
      ⬇ Exportar para Excel
    </a>
  );
}
