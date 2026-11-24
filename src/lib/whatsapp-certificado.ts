import { formatarPreco } from "./formatar";
import { SITE_OFICIAL } from "./site";

/** Link que leva o aluno direto à página de emitir o certificado do curso (pede login se precisar). */
export const linkEmitirCertificado = (slug: string, base = SITE_OFICIAL) =>
  slug ? `${base}/continuar/${encodeURIComponent(slug)}?para=certificado` : `${base}/minha-conta`;

/** Mensagem pronta para quem concluiu um curso grátis e ainda não pagou o certificado. */
export function mensagemCertificado(d: {
  nome: string;
  curso: string;
  link: string;
  precos: { individual: number; essencial: number; profissional: number };
}): string {
  const primeiro = d.nome.includes("@") ? "" : (d.nome.trim().split(/\s+/)[0] ?? "");
  return [
    `Oi${primeiro ? `, ${primeiro}` : ""}! Aqui é da Tecpro Multi Ensino. 🎉`,
    "",
    `Parabéns por concluir o curso *${d.curso}*! Você foi até a última aula, e isso mostra muita dedicação.`,
    "",
    "Agora falta só um passo: emitir o seu certificado. Com ele você:",
    "✅ comprova o que aprendeu no currículo e no LinkedIn;",
    "✅ se destaca em entrevistas e processos seletivos;",
    "✅ tem um documento com código de validação e QR Code, que qualquer empresa pode conferir no nosso site.",
    "",
    `Emita o seu certificado aqui: ${d.link}`,
    "",
    `O certificado individual sai por ${formatarPreco(d.precos.individual)}. Se pensa em fazer outros cursos, vale a pena o pacote com 3 certificados por ${formatarPreco(d.precos.essencial)} ou com 5 por ${formatarPreco(d.precos.profissional)}: os que sobrarem ficam guardados para os próximos cursos.`,
    "",
    "Qualquer dúvida, é só responder esta mensagem. 😊",
  ].join("\n").replace(/ /g, " ");
}

/** Endereço do WhatsApp (wa.me) com a mensagem preenchida. Celular sem DDI ganha o 55. */
export function linkWhatsapp(telefone: string, texto: string): string {
  const n = telefone.replace(/\D/g, "");
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(texto)}`;
}
