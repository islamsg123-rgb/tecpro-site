"use server";

import { estadoValido } from "@/lib/estados";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eDono, exigirAdmin } from "@/lib/admin";
import {
  apagarDepoimento, apagarFuncionario, apagarPesquisa, LISTA_SECOES, listarFuncionarios, obterDepoimento,
  salvarDepoimento, salvarFuncionario, type Secao, dadosExtrasAluno, definirCursoRemovido, salvarDadosAluno,
} from "@/lib/dados/painel";
import { concluirCursoTeste, desfazerConclusaoTeste, obterAluno } from "@/lib/dados";
import { cursosDoAluno } from "@/lib/area-aluno";
import { clientePorEmail } from "@/lib/pagamentos";
import { liberarAcesso } from "@/lib/pagamentos/liberacao";
import { cpfValido, emailValido, soDigitos, telefoneValido } from "@/lib/validacao";
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
  await exigirAdmin("cursos");
  const cursoId = String(f.get("cursoId"));
  if (!(await getCursos()).some((c) => c.id === cursoId)) redirect("/admin/cursos");

  const preco = lerPreco(f.get("preco"));
  const voltar = (q: string) => redirect(`/admin/cursos?${q}&curso=${cursoId}#curso-${cursoId}`);
  if (preco === "invalido") voltar("erro=preco");

  // Certificado: grátis nos cursos pagos; nos gratuitos, cobrado pelos pacotes (Configurações da loja).
  await salvarConfiguracaoCurso({
    cursoId,
    precoCentavos: preco as number | null,
    visivel: f.get("visivel") === "on",
    destaque: f.get("destaque") === "on",
    certificadoModo: null,
    certificadoPrecoCentavos: null,
  });
  await definirCursoGratuito(cursoId, f.get("gratuito") === "on");
  // Atualiza a vitrine, as páginas de curso e a área do aluno.
  revalidatePath("/", "layout");
  voltar("salvo=1");
}

/** Deixa todos os cursos gratuitos (certificado cobrado no final) ou volta todos a pagos. */
export async function gratuitoEmMassa(f: FormData) {
  await exigirAdmin("cursos");
  const cursos = await getCursos();
  await definirCursosGratuitos(String(f.get("acao")) === "pagos" ? [] : cursos.map((c) => c.id));
  revalidatePath("/", "layout");
  redirect("/admin/cursos?massa=1");
}

/** Configurações gerais (prazo de acesso do aluno). */
export async function salvarConfiguracoes(f: FormData) {
  await exigirAdmin("loja");
  const tipo = String(f.get("prazo"));
  let meses: number | null = null;
  if (tipo === "meses") {
    meses = Number(String(f.get("meses") ?? "").trim());
    if (!Number.isInteger(meses) || meses < 1 || meses > 120) redirect("/admin/configuracoes?erro=meses");
  }
  const whatsapp = String(f.get("whatsapp") ?? "").trim().slice(0, 30);
  const emailContato = String(f.get("emailContato") ?? "").trim().toLowerCase().slice(0, 120);
  const instagram = String(f.get("instagram") ?? "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "").slice(0, 60);
  const digitos = whatsapp.replace(/\D/g, "");
  if ((whatsapp && (digitos.length < 10 || digitos.length > 13)) || (emailContato && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContato))) {
    redirect("/admin/configuracoes?erro=contato");
  }
  const precos = ["precoCertIndividual", "precoCertEssencial", "precoCertProfissional"].map((k) => lerPreco(f.get(k)));
  if (precos.some((p) => p === null || p === "invalido")) redirect("/admin/configuracoes?erro=precos#certificados");
  await salvarConfigLoja({
    mesesDeAcesso: meses,
    pesquisaNasAulas: f.get("pesquisaNasAulas") === "on",
    mostrarDepoimentos: f.get("mostrarDepoimentos") === "on",
    whatsapp, emailContato, instagram,
    precoCertIndividual: precos[0] as number,
    precoCertEssencial: precos[1] as number,
    precoCertProfissional: precos[2] as number,
  });
  revalidatePath("/", "layout");
  redirect("/admin/configuracoes?salvo=1");
}

/** Refaz a matrícula de uma venda paga (útil depois de corrigir um problema). */
export async function matricularDeNovo(f: FormData) {
  await exigirAdmin("financeiro");
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
  await exigirAdmin("vendas");
  const tipo = String(f.get("tipo")) === "certificado" ? "certificado" : "curso";
  await marcarContatado(String(f.get("email")), String(f.get("cursoId")), tipo, String(f.get("contatado")) === "1");
  revalidatePath("/admin/carrinhos");
}

export async function salvarMensagens(f: FormData) {
  await exigirAdmin("vendas");
  const titulos = f.getAll("titulo").map(String);
  const textos = f.getAll("texto").map(String);
  const lista = titulos
    .map((t, i) => ({ titulo: t.trim().slice(0, 60), texto: (textos[i] ?? "").trim().slice(0, 1000) }))
    .filter((m) => m.titulo && m.texto);
  await salvarMensagensProntas(lista.length ? lista : MENSAGENS_PADRAO);
  redirect("/admin/carrinhos?mensagens=1#mensagens");
}

export async function criarCupom(f: FormData) {
  await exigirAdmin("vendas");
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
  await exigirAdmin("vendas");
  const c = await obterCupom(String(f.get("codigo")));
  if (c) await salvarCupom({ ...c, ativo: !c.ativo });
  revalidatePath("/admin/cupons");
}

export async function excluirCupom(f: FormData) {
  await exigirAdmin("vendas");
  await apagarCupom(normCupom(String(f.get("codigo"))));
  revalidatePath("/admin/cupons");
}

/* ---------- Pesquisa de satisfação ---------- */

export async function excluirPesquisa(f: FormData) {
  await exigirAdmin("vendas");
  await apagarPesquisa(Number(f.get("id")));
  revalidatePath("/admin/pesquisa");
}

/* ---------- Funcionários ---------- */

export async function salvarFuncionarioAcao(f: FormData) {
  const quem = await exigirAdmin("funcionarios");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const nome = String(f.get("nome") ?? "").trim().slice(0, 80);
  const erro = (e: string) => redirect(`/admin/funcionarios?erro=${e}`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erro("email");
  if (!nome) erro("nome");
  if (eDono(email)) erro("dono");
  let permissoes = f.getAll("permissoes").map(String).filter((p): p is Secao => (LISTA_SECOES as string[]).includes(p));
  // Só o dono pode dar acesso à própria aba de funcionários; um funcionário não pode dar mais do que tem.
  if (!quem.dono) permissoes = permissoes.filter((p) => quem.permissoes.includes(p) && p !== "funcionarios");
  try {
    await salvarFuncionario({ email, nome, permissoes, ativo: f.get("ativo") !== "off" });
  } catch {
    erro("banco");
  }
  redirect(`/admin/funcionarios?salvo=${encodeURIComponent(email)}`);
}

export async function alternarFuncionario(f: FormData) {
  await exigirAdmin("funcionarios");
  const { lista } = await listarFuncionarios();
  const atual = lista.find((x) => x.email === String(f.get("email")));
  if (atual) await salvarFuncionario({ ...atual, ativo: !atual.ativo });
  revalidatePath("/admin/funcionarios");
}

export async function excluirFuncionario(f: FormData) {
  await exigirAdmin("funcionarios");
  await apagarFuncionario(String(f.get("email")));
  revalidatePath("/admin/funcionarios");
}

/* ---------- Depoimentos (Loja virtual) ---------- */

export async function salvarDepoimentoAcao(f: FormData) {
  await exigirAdmin("loja");
  const id = Number(f.get("id") ?? 0) || undefined;
  const nome = String(f.get("nome") ?? "").trim().slice(0, 80);
  const texto = String(f.get("texto") ?? "").trim().slice(0, 1200);
  const voltar = (q: string) => redirect(`/admin/loja/depoimentos?${q}`);
  if (!nome || !texto) voltar("erro=campos");
  let foto = String(f.get("foto") ?? "");
  // A foto chega já reduzida pelo navegador (data:image/jpeg;base64,...). Limite de ~300 KB.
  if (foto && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > 400_000)) voltar("erro=foto");
  if (f.get("removerFoto") === "on") foto = "";
  const antigo = id ? await obterDepoimento(id) : null;
  try {
    await salvarDepoimento({
      id,
      nome,
      texto,
      detalhe: String(f.get("detalhe") ?? "").trim().slice(0, 100) || null,
      foto: foto || (f.get("removerFoto") === "on" ? null : antigo?.foto ?? null),
      ativo: f.get("ativo") === "on",
      ordem: Number(f.get("ordem") ?? 0) || 0,
    });
  } catch {
    voltar("erro=banco");
  }
  revalidatePath("/");
  voltar("salvo=1");
}

export async function alternarDepoimento(f: FormData) {
  await exigirAdmin("loja");
  const d = await obterDepoimento(Number(f.get("id")));
  if (d) await salvarDepoimento({ ...d, ativo: !d.ativo });
  revalidatePath("/");
  revalidatePath("/admin/loja/depoimentos");
}

export async function excluirDepoimento(f: FormData) {
  await exigirAdmin("loja");
  await apagarDepoimento(Number(f.get("id")));
  revalidatePath("/");
  revalidatePath("/admin/loja/depoimentos");
}

/* ---------- Alunos: controle total ---------- */

const ficha = (email: string, q = "") => `/admin/alunos/ficha?email=${encodeURIComponent(email)}${q ? `&${q}` : ""}`;

export async function salvarDadosAlunoAcao(f: FormData) {
  await exigirAdmin("alunos");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const cpf = soDigitos(String(f.get("cpf") ?? ""));
  const telefone = soDigitos(String(f.get("telefone") ?? ""));
  if (cpf && !cpfValido(cpf)) redirect(ficha(email, "erro=cpf#dados"));
  if (telefone && !telefoneValido(telefone)) redirect(ficha(email, "erro=telefone#dados"));
  try {
    await salvarDadosAluno(email, {
      nome: String(f.get("nome") ?? "").trim().slice(0, 100) || null,
      cpf: cpf || null,
      telefone: telefone || null,
      observacoes: String(f.get("observacoes") ?? "").trim().slice(0, 2000) || null,
      cidade: String(f.get("cidade") ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || null,
      estado: estadoValido(String(f.get("estado") ?? "")) ? String(f.get("estado")) : null,
    });
  } catch (e) {
    redirect(ficha(email, `erro=${e instanceof Error && e.message === "colunas" ? "colunas" : "banco"}#dados`));
  }
  revalidatePath("/admin/alunos");
  redirect(ficha(email, "salvo=dados#dados"));
}

/** Libera um curso para o aluno (cria na Escola Avançada, se for o caso, e vincula). */
export async function adicionarCursoAluno(f: FormData) {
  const quem = await exigirAdmin("alunos");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const cursoId = String(f.get("cursoId") ?? "");
  const curso = (await getCursos()).find((c) => c.id === cursoId);
  if (!curso) redirect(ficha(email, "erro=curso#cursos"));
  const [registro, extras, asaas] = await Promise.all([obterAluno(email), dadosExtrasAluno(email), clientePorEmail(email)]);
  const comprador = {
    nome: registro?.nome || asaas?.nome || email,
    email,
    cpf: extras.cpf || asaas?.cpf || "",
    telefone: extras.telefone || asaas?.telefone || "",
  };
  try {
    await definirCursoRemovido(email, cursoId, false, quem.email).catch(() => undefined);
    await liberarAcesso(`painel-${Date.now().toString(36)}`, comprador, cursoId);
  } catch {
    redirect(ficha(email, "erro=matricula#cursos"));
  }
  revalidatePath("/", "layout");
  redirect(ficha(email, "salvo=curso#cursos"));
}

/** Tira o curso do aluno no site (ele deixa de ver as aulas). Pode ser desfeito. */
export async function removerCursoAluno(f: FormData) {
  const quem = await exigirAdmin("alunos");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const cursoId = String(f.get("cursoId") ?? "");
  const desfazer = f.get("desfazer") === "1";
  try {
    await definirCursoRemovido(email, cursoId, !desfazer, quem.email);
  } catch {
    redirect(ficha(email, "erro=colunas#cursos"));
  }
  await registrarEventoMatricula("painel", true, `${quem.email} ${desfazer ? "devolveu" : "removeu"} o curso ${cursoId} de ${email}`);
  revalidatePath("/", "layout");
  redirect(ficha(email, `salvo=${desfazer ? "devolvido" : "removido"}#cursos`));
}

/** Cadastro manual de aluno pelo painel, já com um curso liberado. */
export async function cadastrarAlunoAcao(f: FormData) {
  await exigirAdmin("alunos");
  const nome = String(f.get("nome") ?? "").trim().slice(0, 100);
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const cpf = soDigitos(String(f.get("cpf") ?? ""));
  const telefone = soDigitos(String(f.get("telefone") ?? ""));
  const cursoId = String(f.get("cursoId") ?? "");
  const erro = (e: string) => redirect(`/admin/alunos/novo?erro=${e}`);
  if (nome.length < 3) erro("nome");
  if (!emailValido(email)) erro("email");
  if (!cpfValido(cpf)) erro("cpf");
  if (!telefoneValido(telefone)) erro("telefone");
  if (!(await getCursos()).some((c) => c.id === cursoId)) erro("curso");
  try {
    await liberarAcesso(`painel-${Date.now().toString(36)}`, { nome, email, cpf, telefone }, cursoId);
    await salvarDadosAluno(email, { nome, cpf, telefone, observacoes: "Cadastrado pelo painel" }).catch(() => undefined);
  } catch {
    erro("matricula");
  }
  revalidatePath("/admin/alunos");
  redirect(ficha(email, "salvo=novo"));
}

/**
 * Modo teste (só o dono): marca todas as aulas de todos os cursos liberados para este aluno
 * como concluídas, para testar a emissão do certificado sem assistir às aulas.
 */
export async function concluirCursosTesteAcao(f: FormData) {
  const quem = await exigirAdmin("alunos");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!quem.dono) redirect(ficha(email, "erro=dono#teste"));
  try {
    const cursos = await cursosDoAluno(email);
    for (const c of cursos) await concluirCursoTeste(email, c.curso.id, c.aulas.map((a) => a.id));
  } catch {
    redirect(ficha(email, "erro=teste#teste"));
  }
  revalidatePath("/", "layout");
  redirect(ficha(email, "salvo=teste#teste"));
}

/** Desfaz o modo teste: o progresso volta ao que era antes. */
export async function desfazerCursosTesteAcao(f: FormData) {
  const quem = await exigirAdmin("alunos");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!quem.dono) redirect(ficha(email, "erro=dono#teste"));
  try {
    await desfazerConclusaoTeste(email);
  } catch {
    redirect(ficha(email, "erro=teste#teste"));
  }
  revalidatePath("/", "layout");
  redirect(ficha(email, "salvo=teste-desfeito#teste"));
}
