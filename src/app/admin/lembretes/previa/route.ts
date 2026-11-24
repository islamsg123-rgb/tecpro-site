import { eAdmin } from "@/lib/admin";
import { emailLembrete } from "@/lib/email";
import { linkContinuar, linkDescadastro, obterConfigLembretes } from "@/lib/lembretes";

/** Mostra no navegador como fica o e-mail de lembrete (1º, 2º ou 3º), com dados de exemplo. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await eAdmin("alunos"))) return new Response("Não encontrado", { status: 404 });
  const etapa = Math.min(Math.max(Number(new URL(req.url).searchParams.get("etapa")) || 1, 1), 3);
  const cfg = await obterConfigLembretes();
  const e = emailLembrete({
    nome: "Maria Souza", curso: "Excel Avançado", pct: 45, feitas: 9, total: 20, dias: cfg.dias[etapa - 1], etapa,
    linkContinuar: linkContinuar("excel-avancado"), linkSair: linkDescadastro("maria@exemplo.com"),
  });
  const topo = `<div style="font-family:Arial;background:#011749;color:#fff;padding:10px 16px;font-size:14px">Prévia do ${etapa}º lembrete · Assunto: <strong>${e.assunto.replace(/</g, "&lt;")}</strong></div>`;
  return new Response(e.html.replace("<body", `<body`).replace(/(<body[^>]*>)/, `$1${topo}`), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
