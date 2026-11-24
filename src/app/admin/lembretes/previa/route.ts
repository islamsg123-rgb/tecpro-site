import { eAdmin } from "@/lib/admin";
import { emailDeExemplo, NOME_TIPO, obterConfigLembretes, type TipoLembrete } from "@/lib/lembretes";

/** Mostra no navegador como fica cada e-mail de lembrete (tipo e 1º, 2º ou 3º), com dados de exemplo. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await eAdmin("alunos"))) return new Response("Não encontrado", { status: 404 });
  const q = new URL(req.url).searchParams;
  const etapa = Math.min(Math.max(Number(q.get("etapa")) || 1, 1), 3);
  const tipo = (["parado", "nunca", "interessado"].includes(q.get("tipo") ?? "") ? q.get("tipo") : "parado") as TipoLembrete;
  const e = emailDeExemplo(tipo, etapa, await obterConfigLembretes(), "Maria Souza", "maria@exemplo.com");
  const topo = `<div style="font-family:Arial;background:#011749;color:#fff;padding:10px 16px;font-size:14px">${NOME_TIPO[tipo]} · ${etapa}º lembrete · Assunto: <strong>${e.assunto.replace(/</g, "&lt;")}</strong></div>`;
  return new Response(e.html.replace(/(<body[^>]*>)/, `$1${topo}`), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
