import type { Metadata } from "next";
import Link from "next/link";
import { assinaturaValida } from "@/lib/lembretes";
import { sairDosLembretes, voltarAosLembretes } from "./acoes";

export const metadata: Metadata = { title: "Lembretes de estudo", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ e?: string; t?: string; feito?: string }> };

/**
 * Link do fim do e-mail de lembrete. Pede um clique para confirmar (assim programas de e-mail
 * que abrem os links sozinhos não descadastram ninguém sem querer).
 */
export default async function SairLembretes({ searchParams }: Props) {
  const { e = "", t = "", feito } = await searchParams;
  const valido = Boolean(e) && assinaturaValida(e, t);
  return (
    <section className="mx-auto max-w-lg px-4 py-20">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-marca-900/5 sm:p-10">
        <h1 className="text-2xl font-extrabold text-marca-900">Lembretes de estudo</h1>
        {!valido ? (
          <p className="mt-4 text-slate-600">Este link não é válido. Use o link que veio no fim do e-mail de lembrete.</p>
        ) : feito === "sair" ? (
          <>
            <p className="mt-4 text-slate-600">Pronto! <strong>{e}</strong> não vai mais receber lembretes de estudo.</p>
            <p className="mt-2 text-sm text-slate-500">Seus cursos e seu progresso continuam iguais.</p>
            <form action={voltarAosLembretes} className="mt-6">
              <input type="hidden" name="e" value={e} /><input type="hidden" name="t" value={t} />
              <button className="text-sm font-semibold text-marca-900 underline decoration-laranja-500 underline-offset-4">Mudei de ideia, quero receber de novo</button>
            </form>
          </>
        ) : feito === "voltar" ? (
          <p className="mt-4 text-slate-600">Combinado! Vamos voltar a lembrar você de continuar os estudos.</p>
        ) : (
          <>
            <p className="mt-4 text-slate-600">
              Quer parar de receber os e-mails que lembram você de continuar o curso? Você continua recebendo os e-mails importantes, como o link de acesso.
            </p>
            <form action={sairDosLembretes} className="mt-6">
              <input type="hidden" name="e" value={e} /><input type="hidden" name="t" value={t} />
              <button className="rounded-full bg-marca-900 px-6 py-3 font-bold text-white hover:bg-marca-700">Não quero mais receber lembretes</button>
            </form>
          </>
        )}
        <Link href="/minha-conta" className="mt-8 inline-block text-sm text-slate-500 hover:text-marca-900">Ir para Meus cursos</Link>
      </div>
    </section>
  );
}
