import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { obterConfigLoja } from "@/lib/dados";
import { getCursos } from "@/lib/cursos";
import { formatarPreco } from "@/lib/formatar";
import { montarPacotes } from "@/lib/pacotes-certificado";
import { Titulo } from "@/components/admin/Blocos";
import { Dica } from "@/components/admin/Dica";
import { salvarCertificadoLoja } from "../../acoes";

export const metadata: Metadata = { title: "Certificado" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ salvo?: string; erro?: string; curso?: string; nome?: string }> };

const campo = "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-marca-900";
const reais = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");

export default async function CertificadoLoja({ searchParams }: Props) {
  await exigirAdmin("loja");
  const [{ salvo, erro, curso, nome }, loja, cursos] = await Promise.all([searchParams, obterConfigLoja(), getCursos().catch(() => [])]);
  const pacotes = montarPacotes(loja);
  const cursosOrdenados = [...cursos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const cursoPrevia = cursosOrdenados.find((c) => c.id === curso) ?? cursosOrdenados[0];
  const nomePrevia = (nome ?? "").trim().slice(0, 80);
  const linkPrevia = `/admin/loja/certificado/previa?${new URLSearchParams({
    ...(cursoPrevia ? { curso: cursoPrevia.id } : {}),
    ...(nomePrevia ? { nome: nomePrevia } : {}),
  }).toString()}`;

  return (
    <div className="max-w-4xl space-y-6">
      <Titulo descricao="Preços dos pacotes, vídeo de parabéns e como o certificado fica para o aluno.">Certificado</Titulo>

      <form action={salvarCertificadoLoja} className="space-y-6">
        <section id="precos" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-marca-900">Preços dos pacotes de certificado</h2>
          <p className="mt-1 text-sm text-slate-500">
            Valem para os cursos gratuitos, quando o aluno conclui e vai emitir o certificado. Nos pacotes, 1 certificado vai para o curso
            concluído e os outros ficam guardados como crédito para os próximos cursos. Nos cursos pagos, o certificado é sempre grátis.
            O novo preço vale na hora, no site e no pagamento.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {pacotes.map((p) => (
              <label key={p.id} className="text-sm font-semibold text-marca-900">
                {p.nome} ({p.quantidade} {p.quantidade === 1 ? "certificado" : "certificados"}) — R$
                <input
                  name={`precoCert${p.id[0].toUpperCase()}${p.id.slice(1)}`}
                  inputMode="decimal"
                  required
                  defaultValue={reais(p.precoCentavos)}
                  className={`mt-1 ${campo}`}
                />
              </label>
            ))}
          </div>
          {erro === "precos" && <p className="mt-3 text-sm text-red-700">Confira os três valores (mínimo R$ 5,00 cada).</p>}

          <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-slate-500">Como o aluno vê hoje</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {pacotes.map((p) => (
              <div key={p.id} className={`rounded-2xl border p-4 ${p.destaque ? "border-laranja-500 bg-amber-50" : "border-slate-200"}`}>
                {p.destaque && <span className="mb-2 inline-block rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-marca-900">{p.destaque}</span>}
                <p className="font-semibold text-marca-900">{p.nome}</p>
                {p.economiaCentavos > 0 && <p className="text-xs text-slate-500 line-through">De {formatarPreco(p.precoCheioCentavos)}</p>}
                <p className="text-xl font-extrabold text-marca-900">{formatarPreco(p.precoCentavos)}</p>
                {p.quantidade > 1 && (
                  <Dica texto="Calculado sozinho a partir do preço do Individual. Se o pacote ficar mais caro que comprar avulso, o desconto some.">
                    <p className="text-xs text-slate-600">
                      {formatarPreco(p.porCertificadoCentavos)} cada
                      {p.economiaCentavos > 0 ? ` · economiza ${formatarPreco(p.economiaCentavos)} (${p.descontoPct}%)` : " · sem desconto"}
                    </p>
                  </Dica>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Mudou um preço? Clique em Salvar e este quadro se atualiza.</p>
        </section>

        <section id="video" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-marca-900">Vídeo de parabéns no fim do curso</h2>
          <p className="mt-1 text-sm text-slate-500">
            Aparece na última aula de todos os cursos, quando o aluno conclui, e começa a tocar sozinho, logo acima do quadro &quot;Emitir
            certificado&quot;. O padrão é o vídeo da Tecpro que já vem no site (/video/parabens.mp4). Também aceita link de .mp4, Panda ou
            YouTube. Deixe em branco para não mostrar vídeo.
          </p>
          <input name="videoParabens" defaultValue={loja.videoParabens ?? ""} placeholder="/video/parabens.mp4" className={`mt-4 ${campo}`} />
          {erro === "video" && (
            <p className="mt-3 text-sm text-red-700">Não reconheci esse link. Use /video/parabens.mp4, um link .mp4, do Panda (o de &quot;embed&quot;) ou do YouTube.</p>
          )}
        </section>

        <div className="flex items-center gap-4">
          <button className="rounded-full bg-amber-500 px-7 py-3 font-bold text-marca-900 hover:bg-laranja-400">Salvar</button>
          {salvo && <p className="text-sm font-semibold text-green-700">Salvo! O site já está usando os novos valores.</p>}
        </div>
      </form>

      <section id="previa" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-bold text-marca-900">Ver o certificado</h2>
        <p className="mt-1 text-sm text-slate-500">
          É o modelo que o aluno recebe hoje, com um nome e um CPF de exemplo. A cópia de prévia leva um aviso pequeno &quot;sem validade&quot; no canto.
        </p>
        <form method="get" action="/admin/loja/certificado#previa" className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-semibold text-marca-900">Curso
            <select name="curso" defaultValue={cursoPrevia?.id} className={`mt-1 ${campo}`}>
              {cursosOrdenados.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-marca-900">Nome do aluno (opcional)
            <input name="nome" defaultValue={nomePrevia} placeholder="Maria Aparecida da Silva" maxLength={80} className={`mt-1 ${campo}`} />
          </label>
          <button className="rounded-full bg-marca-900 px-6 py-3 font-bold text-white hover:bg-marca-800">Atualizar prévia</button>
        </form>
        <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:block">
          <iframe src={`${linkPrevia}#view=FitH&toolbar=0`} title="Prévia do certificado" className="aspect-[842/595] w-full" />
        </div>
        <a href={linkPrevia} target="_blank" rel="noopener" className="mt-4 inline-block rounded-full border border-marca-900 px-5 py-2 text-sm font-semibold text-marca-900 hover:bg-marca-50">
          <span className="sm:hidden">Ver o certificado (PDF)</span>
          <span className="hidden sm:inline">Abrir em tela cheia (PDF)</span>
        </a>
      </section>
    </div>
  );
}
