import { NextResponse } from "next/server";
import { alunoLogado } from "@/lib/auth";
import { COOKIE_ORIGEM, DIAS_ORIGEM, descobrirOrigem, origemParaCookie } from "@/lib/origem";

/**
 * Botão "Continuar de onde parei" do e-mail de lembrete (e link do certificado no WhatsApp dos formados).
 * Com login feito, vai direto para o curso. Sem login, guarda o destino num cookie e manda
 * para a tela de entrada; depois do login, o middleware leva o aluno de volta ao curso.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  // ?para=certificado: leva direto para a página de emitir/pagar o certificado (mensagem do WhatsApp para formados).
  const fim = url.searchParams.get("para") === "certificado" ? "/certificado" : "";
  const destino = `/minha-conta/cursos/${encodeURIComponent(slug.replace(/[^a-z0-9-]/gi, ""))}${fim}`;
  const logado = await alunoLogado();
  const resp = NextResponse.redirect(new URL(logado ? destino : "/entrar?continuar=1", url.origin));
  // O link do e-mail traz utm_campaign (qual e-mail foi). Este endereço só redireciona, então a origem
  // é guardada aqui mesmo, no mesmo cookie que as páginas usam ("De onde vêm as vendas").
  const origem = descobrirOrigem(url, "", url.hostname);
  // O Next já codifica o valor do cookie: passa o texto puro para ficar igual ao gravado pelo navegador.
  if (origem) resp.cookies.set(COOKIE_ORIGEM, decodeURIComponent(origemParaCookie(origem)), { path: "/", maxAge: DIAS_ORIGEM * 86400, sameSite: "lax" });
  if (logado) return resp;
  resp.cookies.set("tecpro_voltar", destino, { path: "/", maxAge: 60 * 60 * 24, httpOnly: true, sameSite: "lax", secure: url.protocol === "https:" });
  return resp;
}
