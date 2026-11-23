"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import { configuracoesDosCursos, definirCursoGratuito, definirCursosGratuitos, registrarEventoMatricula, salvarConfigLoja, salvarConfiguracaoCurso, salvarConfiguracoesCursos } from "@/lib/dados";
import { asaasConfigurado, cobrancaParaLiberacao } from "@/lib/pagamentos/asaas";
import { processarPagamento } from "@/lib/pagamentos/liberacao";
import {
  apagarCupom, marcarContatado, MENSAGENS_PADRAO, normCupom, obterCupom, salvarCupom, salvarMensagensProntas,
} from "@/lib/dados/carrinhos";

/** "197,90" / "197.90" / "R$ 197" -> centavos. Vazio -> null. */
function lerPreco(v: FormDataEntryValue | null): number | null | "invalido" {
  const t = String(v ?? "").replace(/[R$\s]/g, "").trim();
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  if (!Number.isFinite(n) || n < 5) return "invalido";
  return Math.round(n * 100);
}

export async function salvarCurso(f: FormData) {
  await exigirAdmin();
  const cursoId = String(f.get("cursoId"));
  if (!(await getCursos()).some((c) => c.id === cursoId)) redirect("/admin/cursos");

  const preco = lerPreco(f.get("preco"));
  const modo = String(f.get("certificadoModo"));
  const precoCert = lerPreco(f.get("certificadoPreco"));
  const voltar = (q: string) => redirect(`/admin/cursos?${q}&curso=${cursoId}#curso-${cursoId}`);

  const gratuito = f.get("gratuito") === "on";
  if (preco === "invalido") voltar("erro=preco");
  if (modo === "pago" && (precoCert === null || precoCert === "invalido")) voltar("erro=certificado");
  // Curso gratuito: o que se cobra é o certificado no final, então ele precisa ter valor.
  if (gratuito && modo !== "pago") voltar("erro=gratuito");

  await salvarConfiguracaoCurso({
    cursoId,
    precoCentavos: preco as number | null,
    visivel: f.get("visivel") === "on",
    destaque: f.get("destaque") === "on",
    certificadoModo: modo === "pago" ? "pago" : "gratis",
    certificadoPrecoCentavos: modo === "pago" ? (precoCert as number) : null,
  });
  await definirCursoGratuito(cursoId, gratuito);
  // Atualiza a vitrine, as páginas de curso e a área do aluno.
  revalidatePath("/", "layout");
  voltar("salvo=1");
}

/** Deixa todos os cursos gratuitos (com certificado pago) ou volta todos a pagos. */
export async function gratuitoEmMassa(f: FormData) {
  await exigirAdmin();
  const cursos = await getCursos();
  if (String(f.get("acao")) === "pagos") {
    await definirCursosGratuitos([]);
  } else {
    const precoCert = lerPreco(f.get("certificadoPreco"));
    if (precoCert === null || precoCert === "invalido") redirect("/admin/cursos?erro=massa");
    const cfg = await configuracoesDosCursos();
    await salvarConfiguracoesCursos(
      cursos.map((c) => {
        const atual = cfg.get(c.id);
        return {
          cursoId: c.id,
          precoCentavos: atual?.precoCentavos ?? null,
          visivel: atual?.visivel ?? c.visivel,
          destaque: atual?.destaque ?? c.destaque,
          certificadoModo: "pago" as const,
          certificadoPrecoCentavos: precoCert as number,
        };
      }),
    );
    await definirCursosGratuitos(cursos.map((c) => c.id));
  }
  revalidatePath("/", "layout");
  redirect("/admin/cursos?massa=1");
}

/** Configurações gerais (prazo de acesso do aluno). */
export async function salvarConfiguracoes(f: FormData) {
  await exigirAdmin();
  const tipo = String(f.get("prazo"));
  let meses: number | null = null;
  if (tipo === "meses") {
    meses = Number(String(f.get("meses") ?? "").trim());
    if (!Number.isInteger(meses) || meses < 1 || meses > 120) redirect("/admin/configuracoes?erro=meses");
  }
  await salvarConfigLoja({ mesesDeAcesso: meses });
  redirect("/admin/configuracoes?salvo=1");
}

/** Refaz a matrícula de uma venda paga (útil depois de corrigir um problema). */
export async function matricularDeNovo(f: FormData) {
  await exigirAdmin();
  const id = String(f.get("cobrancaId") ?? "");
  if (!asaasConfigurado || !id) redirect("/admin/vendas");
  try {
    const { pago, comprador, produto } = await cobrancaParaLiberacao(id);
    if (!pago || !produto) {
      await registrarEventoMatricula("matrícula", false, `Cobrança ${id} não está paga ou não é de um curso.`);
    } else {
      await processarPagamento(id, comprador, produto);
    }
  } catch {
    /* o erro já ficou registrado nos eventos */
  }
  revalidatePath("/admin/alunos");
  redirect("/admin/alunos#eventos");
}

/* ---------- Carrinhos abandonados e cupons ---------- */

export async function alternarContatado(f: FormData) {
  await exigirAdmin();
  const tipo = String(f.get("tipo")) === "certificado" ? "certificado" : "curso";
  await marcarContatado(String(f.get("email")), String(f.get("cursoId")), tipo, String(f.get("contatado")) === "1");
  revalidatePath("/admin/carrinhos");
}

export async function salvarMensagens(f: FormData) {
  await exigirAdmin();
  const titulos = f.getAll("titulo").map(String);
  const textos = f.getAll("texto").map(String);
  const lista = titulos
    .map((t, i) => ({ titulo: t.trim().slice(0, 60), texto: (textos[i] ?? "").trim().slice(0, 1000) }))
    .filter((m) => m.titulo && m.texto);
  await salvarMensagensProntas(lista.length ? lista : MENSAGENS_PADRAO);
  redirect("/admin/carrinhos?mensagens=1#mensagens");
}

export async function criarCupom(f: FormData) {
  await exigirAdmin();
  const codigo = normCupom(String(f.get("codigo") ?? ""));
  const tipo = String(f.get("tipo")) === "valor" ? "valor" : "percentual";
  const aplicaEm = (["tudo", "cursos", "certificados"].includes(String(f.get("aplicaEm"))) ? String(f.get("aplicaEm")) : "tudo") as "tudo" | "cursos" | "certificados";
  const erro = (e: string) => redirect(`/admin/cupons?erro=${e}`);
  if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) erro("codigo");
  let valor: number;
  if (tipo === "percentual") {
    valor = Number(String(f.get("valor") ?? "").replace(",", "."));
    if (!Number.isInteger(valor) || valor < 1 || valor > 100) erro("valor");
  } else {
    const v = lerPreco(f.get("valor"));
    if (v === null || v === "invalido") erro("valor");
    valor = v as number;
  }
  const cursoId = String(f.get("cursoId") ?? "").trim() || null;
  const validade = String(f.get("validade") ?? "").trim() || null;
  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) erro("validade");
  const limite = String(f.get("limite") ?? "").trim();
  const limiteUsos = limite ? Number(limite) : null;
  if (limiteUsos !== null && (!Number.isInteger(limiteUsos) || limiteUsos < 1)) erro("limite");
  try {
    await salvarCupom({ codigo, tipo, valor: valor!, aplicaEm, cursoId, validade, limiteUsos, ativo: true });
  } catch {
    erro("banco");
  }
  redirect(`/admin/cupons?criado=${codigo}`);
}

export async function alternarCupom(f: FormData) {
  await exigirAdmin();
  const c = await obterCupom(String(f.get("codigo")));
  if (c) await salvarCupom({ ...c, ativo: !c.ativo });
  revalidatePath("/admin/cupons");
}

export async function excluirCupom(f: FormData) {
  await exigirAdmin();
  await apagarCupom(normCupom(String(f.get("codigo"))));
  revalidatePath("/admin/cupons");
}
