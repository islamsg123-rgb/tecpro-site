import "server-only";
import { localidadesDosAlunos } from "@/lib/dados/painel";
import { getCursos } from "./cursos";
import { listarCertificados, listarCertificadosPagos, listarAlunos, ultimaAtividadePorAluno } from "./dados";
import { listarCobrancas } from "./pagamentos";
import { nomeForma } from "@/components/admin/EtiquetaSituacao";

/** Dias desde uma data (null = nunca). */
export function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Alunos com a data da última atividade nas aulas. */
export async function alunosComAtividade() {
  const [alunos, atividade] = await Promise.all([listarAlunos(1000), ultimaAtividadePorAluno()]);
  return alunos.map((a) => ({ ...a, ultimaAtividade: atividade.get(a.email) ?? null }));
}

/** Tabela para exportar (primeira linha = títulos). */
export async function tabelaParaExportar(tipo: string): Promise<string[][] | null> {
  if (tipo === "alunos") {
    const [alunos, locais] = await Promise.all([alunosComAtividade(), localidadesDosAlunos()]);
    return [
      ["Nome", "E-mail", "Cidade", "Estado", "Código na Escola Avançada", "Matriculado em", "Última atividade", "Dias sem estudar"],
      ...alunos.map((a) => [
        a.nome ?? "", a.email, locais.get(a.email)?.cidade ?? "", locais.get(a.email)?.estado ?? "",
        a.eaUsuarioId, dataBR(a.criadoEm), dataBR(a.ultimaAtividade),
        String(diasDesde(a.ultimaAtividade) ?? "nunca estudou"),
      ]),
    ];
  }
  if (tipo === "vendas") {
    const vendas = await listarCobrancas();
    return [
      ["Data", "Descrição", "Cliente", "Forma", "Valor (R$)", "Situação", "Código Asaas"],
      ...vendas.map((v) => [
        dataBR(v.criadoEm), v.descricao ?? "", v.cliente ?? "", nomeForma[v.forma] ?? v.forma,
        (v.valorCentavos / 100).toFixed(2).replace(".", ","), v.situacao, v.id,
      ]),
    ];
  }
  if (tipo === "certificados") {
    const [emitidos, pagos, cursos] = await Promise.all([listarCertificados(5000), listarCertificadosPagos(), getCursos()]);
    const pago = new Set(pagos.map((p) => `${p.email}|${p.cursoId}`));
    const nomeCurso = (id: string) => cursos.find((c) => c.id === id)?.nome ?? `curso ${id}`;
    const naoEmitidos = pagos.filter((p) => !emitidos.some((e) => e.email === p.email && e.cursoId === p.cursoId));
    return [
      ["Código", "Aluno", "E-mail", "Curso", "Carga horária", "Emitido em", "Pago"],
      ...emitidos.map((c) => [c.codigo, c.nomeAluno, c.email, c.cursoNome, String(c.cargaHoraria), dataBR(c.emitidoEm), pago.has(`${c.email}|${c.cursoId}`) ? "sim" : "grátis"]),
      ...naoEmitidos.map((p) => ["(pago, ainda não emitido)", "", p.email, nomeCurso(p.cursoId), "", "", "sim"]),
    ];
  }
  return null;
}

/** CSV que o Excel brasileiro abre direto (separador ";" e acentos certos). */
export function paraCsv(linhas: string[][]): string {
  const cel = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // Evita que o Excel execute fórmulas vindas de dados digitados por alunos.
  const seguro = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
  return "﻿" + linhas.map((l) => l.map((v) => cel(seguro(v))).join(";")).join("\r\n");
}
