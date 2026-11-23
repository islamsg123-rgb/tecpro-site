import type { Metadata } from "next";
import Link from "next/link";
import { cursosDoAluno } from "@/lib/area-aluno";
import { situacaoCertificado, type EstadoCertificado } from "@/lib/certificados";
import { atividadesDoAluno, obterAluno } from "@/lib/dados";
import { provaDaAula } from "@/lib/provas";
import { dataBR, diasDesde } from "@/lib/admin-relatorios";
import { BarraProgresso } from "@/components/aluno/Progresso";
import { IconeChevron } from "@/components/Icones";

export const metadata: Metadata = { title: "Ficha do aluno" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ email?: string }> };

const nomeEtapa: Record<string, string> = { inicio: "abriu a aula", video: "assistiu ao vídeo", prova: "passou na prova" };
const nomeCert: Record<EstadoCertificado, [string, string]> = {
  em_andamento: ["Em andamento", "bg-slate-100 text-slate-600"],
  aguardando_pagamento: ["Concluiu, falta pagar", "bg-amber-100 text-amber-800"],
  disponivel: ["Pode emitir", "bg-blue-100 text-blue-800"],
  emitido: ["Emitido", "bg-green-100 text-green-800"],
};

export default async function Ficha({ searchParams }: Props) {
  const email = String((await searchParams).email ?? "").trim().toLowerCase();
  const registro = email ? await obterAluno(email) : null;
  if (!registro) {
    return (
      <>
        <Voltar />
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Aluno não encontrado.</p>
      </>
    );
  }

  const [cursos, atividades] = await Promise.all([
    cursosDoAluno(email).catch(() => null),
    atividadesDoAluno(email),
  ]);
  const certs = cursos ? await Promise.all(cursos.map((c) => situacaoCertificado(email, c))) : [];
  const ultima = atividades[0]?.quando ?? null;
  const dias = diasDesde(ultima);

  const tituloAula = (cursoId: string, aulaId: string) => {
    const c = cursos?.find((x) => x.curso.id === cursoId);
    const [id, etapa] = aulaId.split("#");
    const aula = c?.aulas.find((a) => a.id === id);
    return { curso: c?.curso.nome ?? `curso ${cursoId}`, aula: aula?.titulo ?? `aula ${id}`, etapa: etapa ? nomeEtapa[etapa] ?? etapa : "concluiu a aula" };
  };

  return (
    <>
      <Voltar />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-marca-900">{registro.nome ?? email}</h1>
          <p className="mt-1 text-sm text-slate-500">{email} · código na Escola Avançada {registro.eaUsuarioId}</p>
        </div>
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Última atividade: <strong className="text-marca-900">{ultima ? `${dataBR(ultima)} (${dias === 0 ? "hoje" : `há ${dias} dias`})` : "nunca estudou"}</strong>
        </p>
      </div>

      <h2 className="mt-10 text-xl font-bold text-marca-900">Cursos</h2>
      {cursos === null ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não conseguimos consultar os cursos na Escola Avançada agora. Tente de novo em instantes (veja a aba API).
        </p>
      ) : !cursos.length ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Nenhum curso vinculado.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {cursos.map((c, i) => {
            const comProva = c.aulas.filter((a, n) => provaDaAula(c.curso.nome, n, a.titulo).length > 0).length;
            const aprovadas = new Set(
              atividades.filter((x) => x.cursoId === c.curso.id && x.aulaId.endsWith("#prova")).map((x) => x.aulaId),
            ).size;
            const s = certs[i];
            const [rotulo, cls] = nomeCert[s.estado];
            const ultimaNoCurso = atividades.find((x) => x.cursoId === c.curso.id)?.quando;
            return (
              <div key={c.curso.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-marca-900">{c.curso.nome}</p>
                  {c.curso.gratuito && <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">gratuito</span>}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <BarraProgresso pct={c.pct} />
                  <span className="w-12 text-right text-sm font-bold text-marca-900">{c.pct}%</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-slate-500">Aulas concluídas</dt><dd className="font-semibold text-marca-900">{c.feitas} de {c.total}</dd></div>
                  <div><dt className="text-xs text-slate-500">Provas aprovadas (100%)</dt><dd className="font-semibold text-marca-900">{comProva ? `${aprovadas} de ${comProva}` : "sem provas"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Última atividade no curso</dt><dd className="font-semibold text-marca-900">{ultimaNoCurso ? dataBR(ultimaNoCurso) : "—"}</dd></div>
                  <div>
                    <dt className="text-xs text-slate-500">Certificado</dt>
                    <dd className="mt-0.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{rotulo}</span>
                      {s.certificado && (
                        <Link href={`/validar/${s.certificado.codigo}`} className="ml-2 font-mono text-xs text-marca-700 underline">{s.certificado.codigo}</Link>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mt-10 text-xl font-bold text-marca-900">Histórico nas aulas</h2>
      {!atividades.length ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Ainda não abriu nenhuma aula.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm">
          {atividades.slice(0, 40).map((a, i) => {
            const t = tituloAula(a.cursoId, a.aulaId);
            return (
              <li key={i} className="flex flex-wrap gap-x-3 px-5 py-3">
                <span className="w-24 shrink-0 text-slate-400">{dataBR(a.quando)}</span>
                <span className="font-semibold text-marca-900">{t.etapa}</span>
                <span className="text-slate-600">{t.aula}</span>
                <span className="text-slate-400">· {t.curso}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Voltar() {
  return (
    <Link href="/admin/alunos" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-marca-900">
      <IconeChevron className="h-4 w-4 rotate-90" /> Voltar para alunos
    </Link>
  );
}
