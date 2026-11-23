import type { Metadata } from "next";
import { respostaCrua, ultimosErros, usandoDadosDeExemplo } from "@/lib/escola-avancada/client";
import { getCursos } from "@/lib/cursos";

export const metadata: Metadata = { title: "Diagnóstico da API" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ curso?: string; aluno?: string }> };

async function testar(recurso: string, campos: Record<string, string> = {}) {
  try {
    const r = await respostaCrua(recurso, campos);
    return { ...r, erro: null as string | null };
  } catch (e) {
    return { url: recurso, status: 0, texto: "", erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Mostra a resposta crua da Escola Avançada para conferirmos os nomes dos campos. O token nunca aparece. */
export default async function Diagnostico({ searchParams }: Props) {
  if (usandoDadosDeExemplo) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-extrabold text-marca-900">Diagnóstico da API</h1>
        <p className="mt-4 text-slate-600">
          Faltam as variáveis <code>ESCOLA_AVANCADA_URL</code> e <code>ESCOLA_AVANCADA_TOKEN</code> na Vercel.
        </p>
      </div>
    );
  }
  const { curso, aluno } = await searchParams;
  const [lista, cursos] = await Promise.all([testar("cursos/listar"), getCursos()]);
  const aulas = curso ? await testar("cursos/aulas", { curso }) : null;
  const doAluno = aluno ? await testar("usuarios/cursosvinculados", { id_aluno: aluno }) : null;
  const blocos = [{ titulo: "cursos/listar", r: lista }, ...(aulas ? [{ titulo: `cursos/aulas (curso ${curso})`, r: aulas }] : []),
    ...(doAluno ? [{ titulo: `usuarios/cursosvinculados (aluno ${aluno})`, r: doAluno }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-marca-900">Diagnóstico da API da Escola Avançada</h1>
      <p className="mt-2 text-slate-600">
        Cursos que o site conseguiu entender: <strong className="text-marca-900">{cursos.length}</strong>. Para ver as aulas de um curso,
        acrescente <code>?curso=ID</code> no endereço; para ver os cursos de um aluno, <code>?aluno=ID</code>.
      </p>
      {ultimosErros.size > 0 && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Últimas falhas ao ler a Escola Avançada (neste servidor):</p>
          <ul className="mt-2 space-y-1 break-all">
            {[...ultimosErros].map(([r, m]) => <li key={r}><b>{r}</b>: {m}</li>)}
          </ul>
        </div>
      )}
      {blocos.map(({ titulo, r }) => (
        <section key={titulo} className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-marca-900">{titulo}</h2>
          <p className="mt-1 break-all text-sm text-slate-500">
            {r.url} · status {r.status}
          </p>
          {r.erro && <p className="mt-2 text-sm text-red-700">{r.erro}</p>}
          <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            {r.texto.slice(0, 4000) || "(vazio)"}
          </pre>
        </section>
      ))}
    </div>
  );
}
