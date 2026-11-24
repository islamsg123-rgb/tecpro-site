import { NextResponse } from "next/server";
import { alunoLogado } from "@/lib/auth";

/**
 * Botão "Continuar de onde parei" do e-mail de lembrete.
 * Com login feito, vai direto para o curso. Sem login, guarda o destino num cookie e manda
 * para a tela de entrada; depois do login, o middleware leva o aluno de volta ao curso.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const destino = `/minha-conta/cursos/${encodeURIComponent(slug.replace(/[^a-z0-9-]/gi, ""))}`;
  const url = new URL(req.url);
  if (await alunoLogado()) return NextResponse.redirect(new URL(destino, url.origin));
  const resp = NextResponse.redirect(new URL("/entrar?continuar=1", url.origin));
  resp.cookies.set("tecpro_voltar", destino, { path: "/", maxAge: 60 * 60 * 24, httpOnly: true, sameSite: "lax", secure: url.protocol === "https:" });
  return resp;
}
