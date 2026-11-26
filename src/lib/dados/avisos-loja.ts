import "server-only";
import { bancoEmDemonstracao, db } from "./index";

/**
 * Avisos da loja ("Maria, de Belém (PA), se inscreveu em Excel").
 * SÓ acontecimentos reais: matrículas (carrinhos que chegaram a "matriculado" ou "pago") e certificados emitidos.
 * Mostra apenas o primeiro nome e a cidade; nunca e-mail, sobrenome ou telefone.
 */

export interface AvisoLoja {
  tipo: "inscricao" | "certificado";
  nome: string;
  local: string | null;
  curso: string;
  em: string;
}

/** "MARIA DA SILVA" -> "Maria". Nada que pareça e-mail ou número. */
export function primeiroNome(nome: string | null | undefined): string | null {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^[\p{L}'-]{2,20}$/u.test(p)) return null;
  return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR");
}

const DIAS = 7;

export async function avisosRecentes(nomeCurso: Map<string, string>): Promise<AvisoLoja[]> {
  // Modo demonstração (sem banco, nunca no site publicado): exemplos só para ver o visual.
  if (bancoEmDemonstracao) {
    const h = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    return [
      { tipo: "inscricao", nome: "Leonardo", local: "Belém (PA)", curso: "Informática Essencial", em: h(4) },
      { tipo: "certificado", nome: "Maria", local: "Ananindeua (PA)", curso: "Assistente Administrativo", em: h(35) },
      { tipo: "inscricao", nome: "Ana", local: null, curso: "Excel do Básico ao Avançado", em: h(80) },
    ];
  }
  const desde = new Date(Date.now() - DIAS * 86400_000).toISOString();
  const [ca, ce] = await Promise.all([
    db().from("carrinhos").select("email, nome, curso_id, atualizado_em").eq("tipo", "curso").in("etapa", ["matriculado", "pago"])
      .gte("atualizado_em", desde).order("atualizado_em", { ascending: false }).limit(40),
    db().from("certificados").select("email, nome_aluno, curso_nome, emitido_em").gte("emitido_em", desde).order("emitido_em", { ascending: false }).limit(20),
  ]);
  const emails = [...new Set([...(ca.data ?? []).map((r) => r.email), ...(ce.data ?? []).map((r) => r.email)])];
  const locais = new Map<string, { nome: string | null; local: string | null }>();
  if (emails.length) {
    const { data } = await db().from("alunos").select("*").in("email", emails);
    for (const a of data ?? []) {
      const cidade = typeof a.cidade === "string" ? a.cidade.trim() : "";
      const uf = typeof a.estado === "string" ? a.estado.trim().toUpperCase() : "";
      locais.set(a.email, { nome: a.nome ?? null, local: cidade ? `${cidade}${uf ? ` (${uf})` : ""}` : null });
    }
  }
  const lista: AvisoLoja[] = [];
  for (const r of ce.data ?? []) {
    const nome = primeiroNome(r.nome_aluno) ?? primeiroNome(locais.get(r.email)?.nome);
    if (nome && r.curso_nome) lista.push({ tipo: "certificado", nome, local: locais.get(r.email)?.local ?? null, curso: r.curso_nome, em: r.emitido_em });
  }
  for (const r of ca.data ?? []) {
    const nome = primeiroNome(r.nome) ?? primeiroNome(locais.get(r.email)?.nome);
    const curso = nomeCurso.get(String(r.curso_id));
    if (nome && curso) lista.push({ tipo: "inscricao", nome, local: locais.get(r.email)?.local ?? null, curso, em: r.atualizado_em });
  }
  return lista.sort((a, b) => b.em.localeCompare(a.em)).slice(0, 30);
}
