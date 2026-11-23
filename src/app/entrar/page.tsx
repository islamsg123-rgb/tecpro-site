import Link from "next/link";

// Etapa 3 do plano: login e área do aluno.
export default function Entrar() {
  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold text-marca-900">Área do aluno em construção</h1>
      <p className="mt-4 text-slate-600">Em breve você vai acessar seus cursos, aulas e certificados por aqui.</p>
      <Link href="/cursos" className="mt-8 inline-block font-semibold text-marca-700 underline decoration-laranja-500 decoration-2 underline-offset-4">
        Ver cursos
      </Link>
    </section>
  );
}
