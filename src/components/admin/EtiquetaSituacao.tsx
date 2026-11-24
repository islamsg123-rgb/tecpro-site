import type { Situacao } from "@/lib/pagamentos/tipos";
import { Dica } from "./Dica";

const estilos: Record<Situacao, [string, string, string]> = {
  pago: ["Pago", "bg-green-100 text-green-800", "O dinheiro foi confirmado pelo sistema de pagamento."],
  aguardando: ["Aguardando", "bg-amber-100 text-amber-800", "O Pix ou boleto foi gerado, mas ainda não foi pago. Ainda está no prazo."],
  vencido: ["Vencido", "bg-slate-200 text-slate-700", "Passou do prazo e não foi pago. O aluno precisa gerar um pagamento novo."],
  estornado: ["Estornado", "bg-red-100 text-red-700", "O valor foi devolvido ao cliente (reembolso ou contestação no cartão)."],
};

export function EtiquetaSituacao({ s }: { s: Situacao }) {
  const [rotulo, cls, dica] = estilos[s];
  return (
    <Dica texto={dica}>
      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{rotulo}</span>
    </Dica>
  );
}

export const nomeForma = { PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão" } as const;
