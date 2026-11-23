import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarPreco, getCursoPorSlug } from "@/lib/cursos";

type Props = { params: Promise<{ slug: string }> };

// Etapa 2 do plano: aqui entra o checkout transparente (Asaas ou Mercado Pago).
export default async function Checkout({ params }: Props) {
  const curso = await getCursoPorSlug((await params).slug);
  if (!curso) notFound();
  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold text-marca-900">Checkout em construção</h1>
      <p className="mt-4 text-slate-600">
        Você escolheu <strong>{curso.nome}</strong> por <strong>{formatarPreco(curso.precoCentavos)}</strong>.
        O pagamento será a próxima etapa do projeto.
      </p>
      <Link href={`/cursos/${curso.slug}`} className="mt-8 inline-block font-semibold text-marca-700 underline decoration-laranja-500 decoration-2 underline-offset-4">
        ← Voltar para o curso
      </Link>
    </section>
  );
}
