import type { Metadata } from "next";
import { respostaCrua, testarVariacoes, usandoDadosDeExemplo } from "@/lib/escola-avancada/client";
import { getCursos } from "@/lib/cursos";

export const metadata: Metadata = { title: "Diagnóstico da API" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ curso?: string }> };

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
  const { curso } = await searchParams;
  const [lista, cursos, variacoes] = await Promise.all([testar("cursos/listar"), getCursos(), testarVariacoes("cursos/listar")]);
  const aulas = curso ? await testar("cursos/aulas", { curso }) : null;
  const blocos = [{ titulo: "cursos/listar", r: lista }, ...(aulas ? [{ titulo: `cursos/aulas (curso ${curso})`, r: aulas }] : [])];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-marca-900">Diagnóstico da API da Escola Avançada</h1>
      <p className="mt-2 text-slate-600">
        Cursos que o site conseguiu entender: <strong className="text-marca-900">{cursos.length}</strong>. Para ver as aulas de um curso,
        acrescente <code>?curso=ID</code> no endereço.
      </p>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-marca-900">Formas de chamar cursos/listar</h2>
        <p className="mt-1 text-sm text-slate-500">O site testa cada jeito de enviar o token. O que der status 200 com a lista de cursos é o certo.</p>
        <table className="mt-3 w-full text-left text-xs">
          <tbody>
            {variacoes.map((v) => (
              <tr key={v.nome} className="border-t border-slate-100 align-top">
                <td className="py-2 pr-3 font-semibold text-marca-900">{v.nome}</td>
                <td className={`py-2 pr-3 font-bold ${v.status === 200 ? "text-green-700" : "text-red-700"}`}>{v.status}</td>
                <td className="break-all py-2 font-mono text-slate-600">{v.trecho.slice(0, 200) || "(vazio)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
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
