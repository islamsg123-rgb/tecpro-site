import type { Metadata } from "next";
import Link from "next/link";
import { getCursos } from "@/lib/cursos";
import { listarCarrinhos, listarCupons, mensagensProntas, type Carrinho, type EtapaCarrinho } from "@/lib/dados/carrinhos";
import { formatarPreco } from "@/lib/formatar";
import { BotaoWhatsApp } from "@/components/admin/BotaoWhatsApp";
import { alternarContatado, salvarMensagens } from "../acoes";

export const metadata: Metadata = { title: "Carrinhos abandonados" };
export const dynamic = "force-dynamic";

/** Depois deste tempo sem concluir, o carrinho conta como abandonado. */
const MINUTOS_ABANDONO = 30;

const nomeEtapa: Record<EtapaCarrinho, [string, string]> = {
  contato: ["Preencheu nome e WhatsApp", "bg-amber-100 text-amber-800"],
  pagamento: ["Gerou o pagamento, não pagou", "bg-orange-100 text-orange-800"],
  pago: ["Pagou", "bg-green-100 text-green-800"],
  matriculado: ["Matriculou (grátis)", "bg-green-100 text-green-800"],
};
const nomeForma: Record<string, string> = { PIX: "Pix", BOLETO: "boleto", CREDIT_CARD: "cartão" };

const abandonado = (c: Carrinho) =>
  (c.etapa === "contato" || c.etapa === "pagamento") && Date.now() - new Date(c.atualizadoEm).getTime() > MINUTOS_ABANDONO * 60_000;

function quando(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.floor(min / 60)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

type Props = { searchParams: Promise<{ ver?: string; mensagens?: string }> };

export default async function Carrinhos({ searchParams }: Props) {
  const [{ lista, tabelaFaltando }, cursos, mensagens, { lista: cupons }, sp] = await Promise.all([
    listarCarrinhos(), getCursos(), mensagensProntas(), listarCupons(), searchParams,
  ]);
  const ver = sp.ver ?? "abandonados";
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tecpro-site.vercel.app";
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const cuponsAtivos = cupons.filter((c) => c.ativo && (!c.validade || c.validade >= hoje)).map((c) => c.codigo);

  const abandonados = lista.filter(abandonado);
  const filtrada = ver === "todos" ? lista : ver === "concluidos" ? lista.filter((c) => c.etapa === "pago" || c.etapa === "matriculado") : abandonados;
  const valorPerdido = abandonados.reduce((s, c) => {
    const curso = cursos.find((x) => x.id === c.cursoId);
    return s + (c.valorCentavos ?? (c.tipo === "curso" ? curso?.precoCentavos ?? 0 : 0));
  }, 0);
  const abas = [
    { id: "abandonados", rotulo: `Abandonados (${abandonados.length})` },
    { id: "concluidos", rotulo: "Concluídos" },
    { id: "todos", rotulo: `Todos (${lista.length})` },
  ];

  return (
    <>
      <h1 className="text-3xl font-extrabold text-marca-900">Carrinhos abandonados</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">
        Quem começou a matrícula, preencheu nome e WhatsApp e não terminou (depois de {MINUTOS_ABANDONO} minutos). Escolha uma mensagem pronta e
        clique para chamar a pessoa no WhatsApp.
      </p>

      {tabelaFaltando && (
        <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Falta um passo no Supabase:</strong> rode o arquivo <code>carrinhos-e-cupons.sql</code> no SQL Editor do Supabase para
          começar a guardar os carrinhos e os cupons.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Cartao rotulo="Abandonados" valor={String(abandonados.length)} />
        <Cartao rotulo="Valor que ficou para trás" valor={formatarPreco(valorPerdido)} />
        <Cartao rotulo="Ainda não contatados" valor={String(abandonados.filter((c) => !c.contatadoEm).length)} />
      </div>

      <nav className="mt-8 flex flex-wrap gap-2">
        {abas.map((a) => (
          <Link key={a.id} href={`/admin/carrinhos?ver=${a.id}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${ver === a.id ? "bg-marca-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-marca-900"}`}>
            {a.rotulo}
          </Link>
        ))}
      </nav>

      {!filtrada.length ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nada por aqui.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Pessoa</th>
                <th className="px-5 py-3 font-semibold">O que queria</th>
                <th className="px-5 py-3 font-semibold">Até onde chegou</th>
                <th className="px-5 py-3 font-semibold">Quando</th>
                <th className="px-5 py-3 font-semibold">Contato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrada.map((c) => {
                const curso = cursos.find((x) => x.id === c.cursoId);
                const nomeCurso = curso?.nome ?? `curso ${c.cursoId}`;
                const link = c.tipo === "certificado"
                  ? `${site}/minha-conta/cursos/${curso?.slug ?? ""}#certificado`
                  : `${site}/checkout/${curso?.slug ?? ""}`;
                const [rotulo, cls] = nomeEtapa[c.etapa];
                return (
                  <tr key={`${c.email}|${c.cursoId}|${c.tipo}`} className="align-top hover:bg-marca-50/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-marca-900">{c.nome ?? "—"}</p>
                      <p className="text-xs text-slate-500">{c.email}</p>
                      <p className="text-xs text-slate-500">{formatarTelefone(c.telefone)}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {c.tipo === "certificado" ? "Certificado: " : ""}{nomeCurso}
                      {c.valorCentavos ? <span className="block text-xs text-slate-500">{formatarPreco(c.valorCentavos)}{c.cupom ? ` · cupom ${c.cupom}` : ""}</span> : null}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{rotulo}</span>
                      {c.etapa === "pagamento" && c.forma && <span className="mt-1 block text-xs text-slate-500">por {nomeForma[c.forma] ?? c.forma}</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">{quando(c.atualizadoEm)}</td>
                    <td className="px-5 py-4">
                      {c.telefone && (c.etapa === "contato" || c.etapa === "pagamento") ? (
                        <>
                          <BotaoWhatsApp telefone={c.telefone} nome={c.nome ?? ""} curso={nomeCurso} link={link} mensagens={mensagens} cupons={cuponsAtivos} />
                          <form action={alternarContatado} className="mt-2">
                            <input type="hidden" name="email" value={c.email} />
                            <input type="hidden" name="cursoId" value={c.cursoId} />
                            <input type="hidden" name="tipo" value={c.tipo} />
                            <input type="hidden" name="contatado" value={c.contatadoEm ? "0" : "1"} />
                            <button className="text-xs font-semibold text-slate-500 underline hover:text-marca-900">
                              {c.contatadoEm ? `✓ Contatado ${quando(c.contatadoEm)} (desfazer)` : "Marcar como contatado"}
                            </button>
                          </form>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section id="mensagens" className="mt-12 scroll-mt-24">
        <h2 className="text-xl font-bold text-marca-900">Mensagens prontas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use <code>{"{nome}"}</code>, <code>{"{curso}"}</code>, <code>{"{link}"}</code> e <code>{"{cupom}"}</code>: são trocados pelos dados da pessoa
          na hora de abrir o WhatsApp. Deixe título e texto vazios para apagar uma mensagem.
        </p>
        {sp.mensagens && <p className="mt-3 text-sm font-medium text-green-700">Mensagens salvas.</p>}
        <form action={salvarMensagens} className="mt-4 space-y-4">
          {[...mensagens, { titulo: "", texto: "" }].map((m, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <input name="titulo" defaultValue={m.titulo} placeholder={i >= mensagens.length ? "Nova mensagem: título" : "Título"} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" />
              <textarea name="texto" defaultValue={m.texto} rows={3} placeholder="Texto da mensagem" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
          ))}
          <button className="rounded-full bg-marca-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-marca-800">Salvar mensagens</button>
        </form>
      </section>
    </>
  );
}

function Cartao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{rotulo}</p>
      <p className="mt-2 font-display text-3xl font-bold text-marca-900">{valor}</p>
    </div>
  );
}

function formatarTelefone(t: string | null) {
  if (!t) return "";
  const d = t.replace(/\D/g, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t;
}
