"use client";

import { useState } from "react";

/** Escolhe uma mensagem pronta, preenche nome/curso/link/cupom e abre o WhatsApp da pessoa. */
export function BotaoWhatsApp({
  telefone, nome, curso, link, mensagens, cupons,
}: {
  telefone: string;
  nome: string;
  curso: string;
  link: string;
  mensagens: { titulo: string; texto: string }[];
  cupons: string[];
}) {
  const [i, setI] = useState(0);
  const [cupom, setCupom] = useState(cupons[0] ?? "");
  const modelo = mensagens[i]?.texto ?? "";
  const primeiroNome = nome.split(/\s+/)[0] ?? "";
  const texto = modelo
    .replaceAll("{nome}", primeiroNome)
    .replaceAll("{curso}", curso)
    .replaceAll("{link}", link)
    .replaceAll("{cupom}", cupom || "[sem cupom]");
  const numero = telefone.replace(/\D/g, "");
  const comPais = numero.length <= 11 ? `55${numero}` : numero;
  const url = `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;

  return (
    <div className="flex min-w-[220px] flex-col gap-1.5">
      <select value={i} onChange={(e) => setI(Number(e.currentTarget.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" aria-label="Mensagem pronta">
        {mensagens.map((m, n) => <option key={n} value={n}>{m.titulo}</option>)}
      </select>
      {modelo.includes("{cupom}") && (
        <select value={cupom} onChange={(e) => setCupom(e.currentTarget.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" aria-label="Cupom">
          {!cupons.length && <option value="">Crie um cupom na aba Cupons</option>}
          {cupons.map((c) => <option key={c} value={c}>Cupom {c}</option>)}
        </select>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener"
        title={texto}
        className="flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1ebe5a]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.8-1.1-4.6-4-4.8-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2Z" /></svg>
        Chamar no WhatsApp
      </a>
    </div>
  );
}
