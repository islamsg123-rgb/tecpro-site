"use client";

import { useState } from "react";

/**
 * Gerador de links para divulgar: cada link leva a marca de onde foi postado,
 * e o painel mostra quantas vendas vieram de cada um.
 */
const LUGARES = [
  { id: "instagram", rotulo: "Instagram (bio, stories, posts)", fonte: "instagram", anuncio: false },
  { id: "instagram-ads", rotulo: "Anúncio no Instagram", fonte: "instagram", anuncio: true },
  { id: "facebook", rotulo: "Facebook (página, grupos)", fonte: "facebook", anuncio: false },
  { id: "facebook-ads", rotulo: "Anúncio no Facebook", fonte: "facebook", anuncio: true },
  { id: "whatsapp", rotulo: "WhatsApp (status, grupos, listas)", fonte: "whatsapp", anuncio: false },
  { id: "google-ads", rotulo: "Anúncio no Google", fonte: "google", anuncio: true },
  { id: "youtube", rotulo: "YouTube", fonte: "youtube", anuncio: false },
  { id: "tiktok", rotulo: "TikTok", fonte: "tiktok", anuncio: false },
  { id: "email", rotulo: "E-mail", fonte: "email", anuncio: false },
];

const limpar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export function GeradorLinks({ site, paginas }: { site: string; paginas: { rotulo: string; caminho: string }[] }) {
  const [lugar, setLugar] = useState(LUGARES[0].id);
  const [pagina, setPagina] = useState(paginas[0]?.caminho ?? "/");
  const [campanha, setCampanha] = useState("");
  const [copiado, setCopiado] = useState(false);
  const l = LUGARES.find((x) => x.id === lugar)!;
  const params = new URLSearchParams({ origem: l.fonte });
  if (l.anuncio) params.set("utm_medium", "anuncio");
  if (limpar(campanha)) params.set("utm_campaign", limpar(campanha));
  const link = `${site}${pagina}?${params.toString()}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* navegador sem permissão: a pessoa copia na mão */
    }
  }

  const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm";
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block font-semibold text-marca-900">Onde vai postar</span>
          <select value={lugar} onChange={(e) => setLugar(e.target.value)} className={campo}>
            {LUGARES.map((x) => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold text-marca-900">Para qual página</span>
          <select value={pagina} onChange={(e) => setPagina(e.target.value)} className={campo}>
            {paginas.map((p) => <option key={p.caminho} value={p.caminho}>{p.rotulo}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold text-marca-900">Nome da campanha <span className="font-normal text-slate-500">(opcional)</span></span>
          <input value={campanha} onChange={(e) => setCampanha(e.target.value)} placeholder="ex.: black friday" className={campo} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <code className="min-w-0 flex-1 break-all text-xs text-marca-900">{link}</code>
        <button type="button" onClick={copiar} className="rounded-full bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
