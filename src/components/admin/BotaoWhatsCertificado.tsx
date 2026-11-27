"use client";

import { useState } from "react";
import { anotarChamadaWhatsCertificado } from "@/app/admin/_acoes/whatsapp-chamada";
import { Dica } from "./Dica";

function quando(iso: string): string {
  const d = new Date(iso);
  const tz = { timeZone: "America/Sao_Paulo" } as const;
  const data = d.toLocaleDateString("pt-BR", { ...tz, day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { ...tz, hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

/**
 * Botão verde "Chamar no WhatsApp" (ou cinza, sem celular) para cobrar o certificado de quem concluiu.
 * Com `email` e `cursoId`, cada clique fica anotado no banco e aparece "Chamado em dd/mm às hh:mm";
 * depois disso o botão vira "Chamar de novo". Formados, ficha do aluno e Recuperar vendas usam o mesmo registro.
 */
export function BotaoWhatsCertificado({
  url,
  email,
  cursoId,
  chamadas = [],
  dicaSemCelular = "Este aluno não tem celular cadastrado. Dá para incluir na ficha do aluno (clique no nome dele).",
}: {
  url: string | null;
  email?: string;
  cursoId?: string;
  /** Quando já foi chamado (ISO), a mais recente no fim */
  chamadas?: string[];
  dicaSemCelular?: string;
}) {
  const [vezes, setVezes] = useState(chamadas);
  const ultima = vezes[vezes.length - 1];

  if (!url) {
    return (
      <Dica texto={dicaSemCelular}>
        <span aria-disabled="true" className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400">
          <Icone /> Sem celular
        </span>
      </Dica>
    );
  }
  const anotar = () => {
    // Mostra na hora e grava no banco em seguida (o WhatsApp abre numa aba nova, a página continua aqui).
    setVezes((v) => [...v, new Date().toISOString()]);
    if (email && cursoId) {
      anotarChamadaWhatsCertificado(email, cursoId).then((r) => r && setVezes(r)).catch(() => {});
    }
  };
  const explica = "Abre o seu WhatsApp com a mensagem pronta: parabéns pela conclusão, por que o certificado é importante e o link para emitir o certificado deste curso. Dá para mudar o texto antes de enviar.";
  const historico = vezes.length > 1 ? ` Vezes que foi chamado: ${vezes.map(quando).join("; ")}.` : "";

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {ultima && (
        <Dica texto={`Você clicou em Chamar no WhatsApp para esta pessoa em ${quando(ultima)}.${historico} Fica anotado no painel e aparece em qualquer aparelho. (O painel não sabe se a mensagem foi enviada de fato, só que o WhatsApp foi aberto.)`}>
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            ✓ Chamado em {quando(ultima)}{vezes.length > 1 ? ` · ${vezes.length}x` : ""}
          </span>
        </Dica>
      )}
      <Dica temLink texto={ultima ? `Já foi chamado. ${explica}` : explica}>
        <a
          href={url} target="_blank" rel="noopener" onClick={anotar} onAuxClick={(e) => e.button === 1 && anotar()}
          className={ultima
            ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#25D366] bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
            : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1ebe5a]"}
        >
          <Icone /> {ultima ? "Chamar de novo" : "Chamar no WhatsApp"}
        </a>
      </Dica>
    </span>
  );
}

function Icone() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.8-1.1-4.6-4-4.8-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2Z" /></svg>
  );
}
