import type { Situacao } from "@/lib/pagamentos/tipos";

const estilos: Record<Situacao, [string, string]> = {
  pago: ["Pago", "bg-green-100 text-green-800"],
  aguardando: ["Aguardando", "bg-amber-100 text-amber-800"],
  vencido: ["Vencido", "bg-slate-200 text-slate-700"],
  estornado: ["Estornado", "bg-red-100 text-red-700"],
};

export function EtiquetaSituacao({ s }: { s: Situacao }) {
  const [rotulo, cls] = estilos[s];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{rotulo}</span>;
}

export const nomeForma = { PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão" } as const;
