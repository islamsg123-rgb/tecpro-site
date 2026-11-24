import { Dica } from "./Dica";

/** Botão verde "Chamar no WhatsApp" (ou cinza, sem celular) para cobrar o certificado de quem concluiu. */
export function BotaoWhatsCertificado({ url }: { url: string | null }) {
  if (!url) {
    return (
      <Dica texto="Este aluno não tem celular cadastrado. Dá para incluir na ficha do aluno (clique no nome dele).">
        <span aria-disabled="true" className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400">
          <Icone /> Sem celular
        </span>
      </Dica>
    );
  }
  return (
    <Dica temLink texto="Abre o seu WhatsApp com a mensagem pronta: parabéns pela conclusão, por que o certificado é importante e o link para emitir o certificado deste curso. Dá para mudar o texto antes de enviar.">
      <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1ebe5a]">
        <Icone /> Chamar no WhatsApp
      </a>
    </Dica>
  );
}

function Icone() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.8-1.1-4.6-4-4.8-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2Z" /></svg>
  );
}
