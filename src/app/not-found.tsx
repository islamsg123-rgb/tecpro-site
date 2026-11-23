import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold text-marca-900">Página não encontrada</h1>
      <Link href="/cursos" className="mt-6 inline-block font-semibold text-marca-700 underline decoration-laranja-500 decoration-2 underline-offset-4">
        Ver todos os cursos
      </Link>
    </section>
  );
}
