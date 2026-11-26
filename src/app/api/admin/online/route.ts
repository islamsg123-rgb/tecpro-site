import { NextResponse } from "next/server";
import { acessoPainel, emailsDono } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import { listarFuncionarios } from "@/lib/dados/painel";
import { cadastrosHoje, contatosPorEmail, inicioDeHoje, resumoPresenca } from "@/lib/dados/online";
import { listarVendasRegistradas } from "@/lib/dados/avisos-venda";
import { linkWhatsapp } from "@/lib/whatsapp-certificado";
import type { PaginaOnline, PessoaNoCheckout, RespostaOnline } from "@/lib/online";

/**
 * Quadro "Online agora" do painel (ele pergunta aqui a cada 20 segundos).
 * Mostra quantas pessoas estão na loja e na área do aluno, onde estão, quem está no pagamento,
 * e os números de hoje. Quem é da equipe (dono e funcionários) não conta.
 * Vendas de hoje só para quem vê o Financeiro; e nunca em R$ (a Gestão não mostra dinheiro).
 */
export const dynamic = "force-dynamic";

const cacheEquipe: { em: number; emails: Set<string> } = { em: 0, emails: new Set() };
async function emailsDaEquipe(): Promise<Set<string>> {
  if (Date.now() - cacheEquipe.em < 5 * 60_000) return cacheEquipe.emails;
  const { lista } = await listarFuncionarios().catch(() => ({ lista: [] }));
  cacheEquipe.emails = new Set([...emailsDono(), ...lista.map((f) => f.email.toLowerCase())]);
  cacheEquipe.em = Date.now();
  return cacheEquipe.emails;
}

function contarPor<T>(lista: T[], chave: (x: T) => string | null): { nome: string; n: number }[] {
  const m = new Map<string, number>();
  for (const x of lista) {
    const k = chave(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m, ([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
}

export async function GET(req: Request) {
  const acesso = await acessoPainel();
  if (!acesso) return NextResponse.json({ erro: "sem acesso" }, { status: 403 });
  // Plaquinha do canto do painel: só os dois números, sem consultas extras.
  if (new URL(req.url).searchParams.has("resumo")) {
    const [resumo, equipe] = await Promise.all([resumoPresenca(), emailsDaEquipe()]);
    const on = resumo.online.filter((p) => !p.email || !equipe.has(p.email));
    return NextResponse.json(
      { loja: on.filter((p) => p.area === "loja").length, aluno: on.filter((p) => p.area === "aluno").length, tabelaFaltando: resumo.tabelaFaltando },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const verPessoas = acesso.permissoes.includes("alunos") || acesso.permissoes.includes("vendas");
  const verVendas = acesso.permissoes.includes("financeiro");

  const [resumo, equipe, cursos, cadastros, vendas] = await Promise.all([
    resumoPresenca(),
    emailsDaEquipe(),
    getCursos().catch(() => []),
    cadastrosHoje().catch(() => null),
    verVendas ? listarVendasRegistradas(inicioDeHoje()).then((v) => v.length).catch(() => null) : Promise.resolve(null),
  ]);
  const nomeCurso = new Map(cursos.map((c) => [c.slug, c.nome]));
  const nomePorId = new Map(cursos.map((c) => [c.id, c.nome]));
  const online = resumo.online.filter((p) => !p.email || !equipe.has(p.email));
  const loja = online.filter((p) => p.area === "loja");
  const aluno = online.filter((p) => p.area === "aluno");

  const paginas: Partial<Record<PaginaOnline, number>> = {};
  for (const p of loja) paginas[p.pagina] = (paginas[p.pagina] ?? 0) + 1;

  const pagando = loja.filter((p) => p.pagina === "checkout" || p.pagina === "pagando");
  const contatos = verPessoas ? await contatosPorEmail([...new Set(pagando.map((p) => p.email).filter((e): e is string => Boolean(e)))]).catch(() => new Map()) : new Map();
  const noCheckout: PessoaNoCheckout[] = pagando.map((p) => {
    const c = p.email ? contatos.get(p.email) : undefined;
    // Na tela do Pix/boleto o endereço não diz o curso: usa o último carrinho da pessoa.
    const curso = (p.cursoSlug ? nomeCurso.get(p.cursoSlug) : c?.cursoId ? nomePorId.get(c.cursoId) : null) ?? null;
    const nome = verPessoas ? c?.nome ?? null : null;
    const primeiro = (nome ?? "").split(/\s+/)[0];
    const texto = `Oi${primeiro ? `, ${primeiro}` : ""}! Aqui é da Tecpro Multi Ensino. Vi que você está finalizando sua inscrição${curso ? ` no curso ${curso}` : ""}. Posso te ajudar com alguma dúvida no pagamento?`;
    return {
      nome,
      email: verPessoas ? p.email : null,
      curso,
      pagina: p.pagina as "checkout" | "pagando",
      ficha: verPessoas && p.email && acesso.permissoes.includes("alunos") ? `/admin/alunos/ficha?email=${encodeURIComponent(p.email)}` : null,
      whatsapp: verPessoas && c?.telefone ? linkWhatsapp(c.telefone, texto) : null,
    };
  });

  const resposta: RespostaOnline = {
    tabelaFaltando: resumo.tabelaFaltando,
    atualizadoEm: new Date().toISOString(),
    loja: {
      total: loja.length,
      paginas,
      cursosVistos: contarPor(loja.filter((p) => p.pagina === "curso" || p.pagina === "checkout"), (p) => (p.cursoSlug ? nomeCurso.get(p.cursoSlug) ?? null : null)).slice(0, 5),
      noCheckout,
    },
    aluno: {
      total: aluno.length,
      assistindo: aluno.filter((p) => p.pagina === "aula").length,
      porCurso: contarPor(aluno.filter((p) => p.pagina === "aula"), (p) => (p.cursoSlug ? nomeCurso.get(p.cursoSlug) ?? p.cursoSlug : null)).slice(0, 8),
    },
    hoje: { visitas: resumo.visitasHoje, cadastros, vendas },
  };
  return NextResponse.json(resposta, { headers: { "Cache-Control": "no-store" } });
}
