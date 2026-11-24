import { eAdmin } from "@/lib/admin";
import { obterMensagem } from "@/lib/dados/mensagens";

/** Mostra a imagem (print) anexada a uma mensagem de ajuda. Só para quem tem acesso a Mensagens. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await eAdmin("mensagens"))) return new Response("Não encontrado", { status: 404 });
  const m = await obterMensagem(Number((await params).id));
  const achou = m?.print?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!achou) return new Response("Sem imagem", { status: 404 });
  return new Response(Buffer.from(achou[2], "base64"), {
    headers: { "Content-Type": achou[1], "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
