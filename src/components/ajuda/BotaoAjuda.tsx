import { obterConfigLoja } from "@/lib/dados";
import { JanelaAjuda } from "./JanelaAjuda";

/** Bolinha de ajuda (lê o WhatsApp da loja para oferecer como alternativa). */
export async function BotaoAjuda() {
  const loja = await obterConfigLoja().catch(() => null);
  return <JanelaAjuda whatsapp={loja?.whatsapp ?? ""} />;
}
