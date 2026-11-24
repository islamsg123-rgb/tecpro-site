import type { Metadata } from "next";
import Link from "next/link";
import { cursosDoAluno } from "@/lib/area-aluno";
import { situacaoCertificado, type EstadoCertificado } from "@/lib/certificados";
import { atividadesDoAluno, obterAluno, saldoCreditos } from "@/lib/dados";
import { provaDaAula } from "@/lib/provas";
import { dataBR, dataHoraBR, diasDesde } from "@/lib/admin-relatorios";
import { BarraProgresso } from "@/components/aluno/Progresso";
import { eDono, exigirAdmin } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import { formatarPreco } from "@/lib/formatar";
import { cobrancasDoEmail, clientePorEmail } from "@/lib/pagamentos";
import { listarCarrinhos } from "@/lib/dados/carrinhos";
import { cursosRemovidos, dadosExtrasAluno, listarPesquisas, obterFuncionario } from "@/lib/dados/painel";
import { ESTADOS } from "@/lib/estados";
import { DIAS_PARA_INATIVO } from "@/lib/painel-resumo";
import { TabelaVendas } from "@/components/admin/TabelaVendas";
import { EtiquetaAluno } from "@/components/admin/Blocos";
import { adicionarCursoAluno, concluirCursosTesteAcao, desfazerCursosTesteAcao, removerCursoAluno, salvarDadosAlunoAcao, excluirAlunoAcao } from "../../acoes";
import { IconeChevron } from "@/components/Icones";
import { Dica } from "@/components/admin/Dica";

export const metadata: Metadata = { title: "Ficha do aluno" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ email?: string; salvo?: string; erro?: string }> };

const avisos: Record<string, [string, boolean]> = {
  "salvo:dados": ["Dados salvos.", true],
  "salvo:curso": ["Curso liberado para o aluno.", true],
  "salvo:removido": ["Curso removido. O aluno não vê mais esse curso (dá para devolver abaixo).", true],
  "salvo:devolvido": ["Curso devolvido ao aluno.", true],
  "salvo:novo": ["Aluno cadastrado e curso liberado.", true],
  "erro:cpf": ["CPF inválido.", false],
  "erro:telefone": ["Telefone inválido.", false],
  "erro:colunas": ["Falta rodar o SQL novo no Supabase (painel-completo.sql) para salvar isso.", false],
  "salvo:teste": ["Pronto: todos os cursos deste aluno estão como concluídos. Entre no site com a conta dele para testar o certificado.", true],
  "salvo:teste-desfeito": ["Modo teste desfeito: o progresso voltou ao que era antes.", true],
  "erro:teste": ["Não foi possível concluir agora (a Escola Avançada ou o banco não respondeu). Tente de novo.", false],
  "erro:dono": ["Só o dono do site pode usar o modo teste.", false],
  "erro:excluir-dono": ["Só o dono do site pode excluir alunos.", false],
  "erro:excluir-admin": ["Não é possível excluir o dono do site nem a sua própria conta.", false],
  "erro:excluir-funcionario": ["Esta pessoa é funcionária do painel. Tire-a da aba Funcionários antes de excluir.", false],
  "erro:excluir-confirmacao": ["O e-mail digitado não confere. Nada foi excluído.", false],
  "erro:excluir-demo": ["No modo demonstração não dá para excluir alunos.", false],
  "erro:excluir-falhou": ["Não foi possível excluir agora (o banco não respondeu). Tente de novo; se continuar, veja a aba Diagnóstico.", false],
  "erro:banco": ["Não foi possível salvar agora.", false],
  "erro:curso": ["Escolha um curso.", false],
  "erro:matricula": ["A Escola Avançada não aceitou a matrícula. Veja o motivo em Alunos > Últimas tentativas de matrícula (no fim da página Alunos). Se faltar CPF ou telefone, preencha os dados acima.", false],
};

const nomeEtapa: Record<string, string> = { inicio: "abriu a aula", video: "assistiu ao vídeo", prova: "passou na prova", teste: "curso concluído pelo modo teste" };
const nomeCert: Record<EstadoCertificado, [string, string, string]> = {
  em_andamento: ["Em andamento", "bg-slate-100 text-slate-600", "O aluno ainda não terminou todas as aulas deste curso."],
  aguardando_pagamento: ["Concluiu, falta pagar", "bg-amber-100 text-amber-800", "Concluiu um curso grátis. O certificado é pago e o aluno ainda não pagou."],
  disponivel: ["Pode emitir", "bg-blue-100 text-blue-800", "Certificado liberado (curso pago ou certificado já pago), mas o aluno ainda não clicou para gerar."],
  emitido: ["Emitido", "bg-green-100 text-green-800", "Certificado já gerado. Clique no código ao lado para ver a validação."],
};

export default async function Ficha({ searchParams }: Props) {
  const acesso = await exigirAdmin("alunos");
  const params = await searchParams;
  const email = String(params.email ?? "").trim().toLowerCase();
  const [registro, { lista: carrinhosTodos }] = await Promise.all([email ? obterAluno(email) : null, listarCarrinhos(2000)]);
  const carrinhos = carrinhosTodos.filter((c) => c.email === email);
  if (!email || (!registro && !carrinhos.length)) {
    return (
      <>
        <Voltar />
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Aluno não encontrado.</p>
      </>
    );
  }

  const [cursos, atividades, extras, asaas, pagamentos, removidos, todosCursos, { lista: pesquisasTodas }] = await Promise.all([
    registro ? cursosDoAluno(email).catch(() => null) : Promise.resolve([]),
    atividadesDoAluno(email),
    dadosExtrasAluno(email),
    clientePorEmail(email),
    cobrancasDoEmail(email).catch(() => null),
    cursosRemovidos(email),
    getCursos(),
    listarPesquisas(500),
  ]);
  const pesquisas = pesquisasTodas.filter((p) => p.email === email);
  // Mais avançados primeiro; empate: o que teve atividade mais recente.
  const ultimaNo = (id: string) => atividades.find((x) => x.cursoId === id)?.quando ?? "";
  cursos?.sort((a, b) => b.pct - a.pct || ultimaNo(b.curso.id).localeCompare(ultimaNo(a.curso.id)));
  const certs = cursos ? await Promise.all(cursos.map((c) => situacaoCertificado(email, c))) : [];
  const creditos = await saldoCreditos(email).catch(() => 0);
  const ultima = atividades[0]?.quando ?? null;
  const dias = diasDesde(ultima);
  const situacao = dias === null ? "interessado" : dias >= DIAS_PARA_INATIVO ? "inativo" : "ativo";
  const nome = registro?.nome ?? carrinhos[0]?.nome ?? asaas?.nome ?? email;
  const telefone = extras.telefone ?? asaas?.telefone ?? carrinhos.find((c) => c.telefone)?.telefone ?? "";
  const cpf = extras.cpf ?? asaas?.cpf ?? "";
  const nomeCurso = (id: string) => todosCursos.find((c) => c.id === id)?.nome ?? `curso ${id}`;
  const idsAtuais = new Set((cursos ?? []).map((c) => c.curso.id));
  const paraAdicionar = [...todosCursos].filter((c) => !idsAtuais.has(c.id)).sort((a, b) => a.nome.localeCompare(b.nome));
  const pagos = (pagamentos ?? []).filter((p) => p.situacao === "pago");
  const aviso = params.salvo ? avisos[`salvo:${params.salvo}`] : params.erro ? avisos[`erro:${params.erro}`] : null;
  const campo = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal";
  const funcionario = acesso.dono ? await obterFuncionario(email).catch(() => null) : null;
  const protegido =
    email === acesso.email.toLowerCase() ? "Esta é a sua própria conta. Ela não pode ser excluída por aqui."
    : eDono(email) ? "Este e-mail é do dono do site e não pode ser excluído por aqui."
    : funcionario ? "Esta pessoa é funcionária do painel. Para excluí-la, tire-a primeiro da aba Funcionários."
    : null;

  const tituloAula = (cursoId: string, aulaId: string) => {
    const c = cursos?.find((x) => x.curso.id === cursoId);
    const [id, etapa] = aulaId.split("#");
    const aula = c?.aulas.find((a) => a.id === id);
    return { curso: c?.curso.nome ?? nomeCurso(cursoId), aula: aula?.titulo ?? `aula ${id}`, etapa: etapa ? nomeEtapa[etapa] ?? etapa : "concluiu a aula" };
  };

  return (
    <>
      <Voltar />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-marca-900">{nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <EtiquetaAluno s={situacao} />
            {email}{registro ? ` · código na Escola Avançada ${registro.eaUsuarioId}` : " · ainda sem matrícula"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {creditos > 0 && (
            <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
              Certificados no pacote: <strong>{creditos}</strong>
            </p>
          )}
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-600">
            Total pago: <strong className="text-marca-900">{formatarPreco(pagos.reduce((s, p) => s + p.valorCentavos, 0))}</strong>
          </p>
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-600">
            Última atividade: <strong className="text-marca-900">{ultima ? `${dataHoraBR(ultima)} (${dias === 0 ? "hoje" : `há ${dias} dias`})` : "nunca estudou"}</strong>
          </p>
          {telefone && (
            <a href={`https://wa.me/${telefone.replace(/\D/g, "").length <= 11 ? "55" : ""}${telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">
              WhatsApp
            </a>
          )}
        </div>
      </div>

      {aviso && (
        <p className={`mt-6 rounded-2xl border p-4 text-sm ${aviso[1] ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>{aviso[0]}</p>
      )}

      <h2 id="dados" className="mt-10 scroll-mt-24 text-xl font-bold text-marca-900">Dados do aluno</h2>
      <form action={salvarDadosAlunoAcao} className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <input type="hidden" name="email" value={email} />
        <label className="font-semibold text-marca-900">Nome<input name="nome" defaultValue={registro?.nome ?? nome} disabled={!registro} className={campo} /></label>
        <label className="font-semibold text-marca-900">E-mail (login)<input value={email} readOnly className={`${campo} bg-slate-50`} /></label>
        <label className="font-semibold text-marca-900">CPF<input name="cpf" defaultValue={cpf} disabled={!registro} className={campo} /></label>
        <label className="font-semibold text-marca-900">Telefone / WhatsApp<input name="telefone" defaultValue={telefone} disabled={!registro} className={campo} /></label>
        <label className="font-semibold text-marca-900">Cidade<input name="cidade" defaultValue={extras.cidade ?? ""} disabled={!registro} className={campo} /></label>
        <label className="font-semibold text-marca-900">Estado
          <select name="estado" defaultValue={extras.estado ?? ""} disabled={!registro} className={`${campo} bg-white`}>
            <option value="">—</option>
            {ESTADOS.map(([uf, n]) => <option key={uf} value={uf}>{n}</option>)}
          </select>
        </label>
        <label className="font-semibold text-marca-900 sm:col-span-2">Observações internas <span className="font-normal text-slate-400">(só a equipe vê)</span>
          <textarea name="observacoes" rows={2} defaultValue={extras.observacoes ?? ""} disabled={!registro} className={campo} />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          {registro ? (
            <button className="rounded-full bg-marca-900 px-6 py-2.5 font-semibold text-white hover:bg-marca-800">Salvar dados</button>
          ) : (
            <p className="text-slate-500">Esta pessoa só preencheu o contato no checkout. Libere um curso abaixo para virar aluno.</p>
          )}
          {extras.colunasFaltando && <p className="text-amber-700">Para salvar todos os dados (incluindo cidade e estado), rode o SQL novo no Supabase.</p>}
          {asaas && <p className="text-xs text-slate-400">CPF e telefone vêm do cadastro de pagamento quando não foram editados aqui.</p>}
        </div>
      </form>

      <h2 id="cursos" className="mt-10 scroll-mt-24 text-xl font-bold text-marca-900">Cursos</h2>
      {cursos === null ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não conseguimos consultar os cursos na Escola Avançada agora. Tente de novo em instantes (veja a aba API).
        </p>
      ) : !cursos.length ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Nenhum curso liberado.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {cursos.map((c, i) => {
            const comProva = c.aulas.filter((a, n) => provaDaAula(c.curso.nome, n, a.titulo).length > 0).length;
            const aprovadas = new Set(
              atividades.filter((x) => x.cursoId === c.curso.id && x.aulaId.endsWith("#prova")).map((x) => x.aulaId),
            ).size;
            const s = certs[i];
            const [rotulo, cls, explica] = nomeCert[s.estado];
            const ultimaNoCurso = atividades.find((x) => x.cursoId === c.curso.id)?.quando;
            return (
              <div key={c.curso.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-marca-900">{c.curso.nome}</p>
                  {c.curso.gratuito && <Dica texto="Curso grátis: o aluno estuda sem pagar e só paga se quiser o certificado no final." className="shrink-0"><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">gratuito</span></Dica>}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <BarraProgresso pct={c.pct} />
                  <span className="w-12 text-right text-sm font-bold text-marca-900">{c.pct}%</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-slate-500">Aulas concluídas</dt><dd className="font-semibold text-marca-900">{c.feitas} de {c.total}</dd></div>
                  <div><dt className="text-xs text-slate-500">Provas aprovadas (100%)</dt><dd className="font-semibold text-marca-900">{comProva ? `${aprovadas} de ${comProva}` : "sem provas"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Última atividade no curso</dt><dd className="font-semibold text-marca-900">{ultimaNoCurso ? dataHoraBR(ultimaNoCurso) : "—"}</dd></div>
                  <div>
                    <dt className="text-xs text-slate-500">Certificado</dt>
                    <dd className="mt-0.5">
                      <Dica texto={explica}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{rotulo}</span></Dica>
                      {s.certificado && (
                        <Link href={`/validar/${s.certificado.codigo}`} className="ml-2 font-mono text-xs text-marca-700 underline">{s.certificado.codigo}</Link>
                      )}
                    </dd>
                  </div>
                </dl>
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-red-600">Remover este curso do aluno</summary>
                  <form action={removerCursoAluno} className="mt-2 rounded-xl bg-red-50 p-3">
                    <input type="hidden" name="email" value={email} />
                    <input type="hidden" name="cursoId" value={c.curso.id} />
                    <p className="text-xs text-red-800">O aluno deixa de ver este curso no site. O progresso fica guardado e dá para devolver depois.</p>
                    <button className="mt-2 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Sim, remover</button>
                  </form>
                </details>
              </div>
            );
          })}
        </div>
      )}

      {acesso.dono && cursos && cursos.length > 0 && (
        <div id="teste" className="mt-4 scroll-mt-24 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-5 text-sm">
          <p className="font-bold text-marca-900">Modo teste: concluir todos os cursos deste aluno</p>
          <p className="mt-1 text-amber-900">
            Marca todas as aulas dos {cursos.length} cursos acima como assistidas, para testar o certificado sem assistir às aulas.
            Use só na sua conta de teste. O botão &quot;Desfazer&quot; volta o progresso ao que era antes (certificados já emitidos continuam).
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <form action={concluirCursosTesteAcao}>
              <input type="hidden" name="email" value={email} />
              <button className="rounded-full bg-amber-500 px-5 py-2 font-bold text-marca-900 hover:bg-amber-400">Concluir todos os cursos</button>
            </form>
            <form action={desfazerCursosTesteAcao}>
              <input type="hidden" name="email" value={email} />
              <button className="rounded-full border border-amber-500 px-5 py-2 font-semibold text-marca-900 hover:bg-white">Desfazer</button>
            </form>
          </div>
        </div>
      )}

      {removidos.size > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm">
          <p className="font-semibold text-marca-900">Cursos removidos deste aluno</p>
          <ul className="mt-2 space-y-2">
            {Array.from(removidos).map((id) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-600">{nomeCurso(id)}</span>
                <form action={removerCursoAluno}>
                  <input type="hidden" name="email" value={email} />
                  <input type="hidden" name="cursoId" value={id} />
                  <input type="hidden" name="desfazer" value="1" />
                  <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-marca-900 hover:border-marca-900">Devolver</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={adicionarCursoAluno} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <input type="hidden" name="email" value={email} />
        <label className="min-w-[240px] flex-1 font-semibold text-marca-900">Liberar outro curso para {registro ? "este aluno" : "esta pessoa"}
          <select name="cursoId" required defaultValue="" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal">
            <option value="" disabled>Escolha o curso…</option>
            {paraAdicionar.map((c) => <option key={c.id} value={c.id}>{c.nome}{removidos.has(c.id) ? " (removido antes)" : ""}</option>)}
          </select>
        </label>
        <button className="rounded-full bg-laranja-500 px-5 py-2.5 font-bold text-marca-900 hover:bg-laranja-400">Liberar curso</button>
        <p className="w-full text-xs text-slate-500">Libera na Escola Avançada sem cobrança (para bolsas, pagamentos por fora ou correções). O aluno recebe o e-mail de boas-vindas.</p>
      </form>

      <h2 className="mt-10 text-xl font-bold text-marca-900">Pagamentos</h2>
      <div className="mt-4">
        {pagamentos === null ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não conseguimos consultar os pagamentos agora.</p>
        ) : (
          <TabelaVendas vendas={pagamentos} />
        )}
      </div>

      {carrinhos.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-bold text-marca-900">Interesse e checkout</h2>
          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm">
            {carrinhos.map((c) => (
              <li key={`${c.cursoId}|${c.tipo}`} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                <span><strong className="text-marca-900">{c.tipo === "certificado" ? "Certificado de " : ""}{nomeCurso(c.cursoId)}</strong> <span className="text-slate-500">· {c.etapa === "contato" ? "preencheu o contato" : c.etapa === "pagamento" ? "gerou o pagamento" : c.etapa}</span></span>
                <span className="text-slate-400">{dataBR(c.atualizadoEm)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {pesquisas.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-bold text-marca-900">Pesquisas respondidas</h2>
          <ul className="mt-4 space-y-2">
            {pesquisas.map((p) => (
              <li key={p.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm">
                <span className="text-laranja-500">{"★".repeat(p.nota)}{"☆".repeat(5 - p.nota)}</span> <span className="text-slate-500">· {p.cursoNome} · {dataBR(p.criadoEm)}</span>
                {p.comentario && <p className="mt-1 text-slate-700">“{p.comentario}”</p>}
              </li>
            ))}
          </ul>
        </>
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
                <span className="w-36 shrink-0 text-slate-400">{dataHoraBR(a.quando)}</span>
                <span className="font-semibold text-marca-900">{t.etapa}</span>
                <span className="text-slate-600">{t.aula}</span>
                <span className="text-slate-400">· {t.curso}</span>
              </li>
            );
          })}
        </ul>
      )}

      {acesso.dono && (registro || carrinhos.length > 0) && (
        <ZonaExcluir email={email} nome={nome} protegido={protegido} cursos={cursos?.length ?? 0} eaUsuarioId={registro?.eaUsuarioId ?? null} />
      )}
    </>
  );
}

function ZonaExcluir({ email, nome, protegido, cursos, eaUsuarioId }: { email: string; nome: string; protegido: string | null; cursos: number; eaUsuarioId: string | null }) {
  return (
    <section id="excluir" className="mt-14 scroll-mt-24 rounded-2xl border-2 border-red-200 bg-white p-5 text-sm">
      <h2 className="text-lg font-bold text-red-700">Excluir aluno</h2>
      {protegido ? (
        <p className="mt-2 text-slate-600">{protegido}</p>
      ) : (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-red-700 hover:text-red-800">Quero excluir {nome === email ? "esta pessoa" : nome} do site</summary>
          <form action={excluirAlunoAcao} className="mt-4 space-y-4 rounded-xl bg-red-50 p-4 text-red-900">
            <input type="hidden" name="email" value={email} />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-bold">Apaga de vez (não dá para desfazer)</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>o login: o aluno não consegue mais entrar com este e-mail</li>
                  <li>nome, CPF, telefone, cidade e observações</li>
                  <li>o progresso nas aulas e as provas feitas</li>
                  <li>os contatos do checkout (carrinhos)</li>
                </ul>
              </div>
              <div>
                <p className="font-bold">Continua guardado, sem os dados pessoais</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>pagamentos: o valor continua no Financeiro, como &quot;Aluno excluído&quot;</li>
                  <li>certificados já emitidos: o código continua válido na página de validação</li>
                  <li>notas das pesquisas de satisfação, sem nome</li>
                </ul>
              </div>
            </div>
            <p className="rounded-lg bg-white/70 p-3">
              <strong>Na Escola Avançada o aluno continua cadastrado</strong>
              {eaUsuarioId ? <> (código {eaUsuarioId}{cursos ? `, ${cursos} ${cursos === 1 ? "curso" : "cursos"}` : ""})</> : null}.
              Se quiser tirá-lo de lá também, faça pelo painel da Escola Avançada.
            </p>
            <label className="block font-semibold">
              Para confirmar, digite o e-mail do aluno: <span className="font-mono">{email}</span>
              <input name="confirmacao" required autoComplete="off" spellCheck={false} placeholder={email} className="mt-1 w-full rounded-xl border border-red-300 bg-white px-3 py-2 font-normal text-slate-900" />
            </label>
            <button className="rounded-full bg-red-600 px-6 py-2.5 font-bold text-white hover:bg-red-700">Excluir aluno definitivamente</button>
          </form>
        </details>
      )}
    </section>
  );
}

function Voltar() {
  return (
    <Link href="/admin/alunos" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-marca-900">
      <IconeChevron className="h-4 w-4 rotate-90" /> Voltar para alunos
    </Link>
  );
}
