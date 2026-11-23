"use client";

import { useState } from "react";

/** Escolhe uma foto, reduz no próprio navegador (400 px, JPEG) e guarda no campo escondido "foto". */
export function CampoFoto({ atual }: { atual: string | null }) {
  const [foto, setFoto] = useState<string>("");
  const [erro, setErro] = useState("");

  async function escolher(arquivo: File | undefined) {
    setErro("");
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) return setErro("Escolha um arquivo de imagem (JPG ou PNG).");
    const url = URL.createObjectURL(arquivo);
    try {
      const img = new Image();
      await new Promise((ok, falha) => { img.onload = ok; img.onerror = falha; img.src = url; });
      const lado = Math.min(img.width, img.height);
      const tam = Math.min(400, lado);
      const canvas = document.createElement("canvas");
      canvas.width = tam;
      canvas.height = tam;
      // Corta no centro para ficar quadrada.
      canvas.getContext("2d")!.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, tam, tam);
      setFoto(canvas.toDataURL("image/jpeg", 0.82));
    } catch {
      setErro("Não conseguimos abrir essa imagem.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const mostrar = foto || atual;
  return (
    <div className="flex items-center gap-4">
      <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-xs text-slate-400">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {mostrar ? <img src={mostrar} alt="" className="h-full w-full object-cover" /> : "sem foto"}
      </span>
      <div className="text-sm">
        <input type="file" accept="image/*" onChange={(e) => escolher(e.currentTarget.files?.[0])} className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-marca-50 file:px-4 file:py-2 file:font-semibold file:text-marca-900" />
        <input type="hidden" name="foto" value={foto} />
        {atual && !foto && (
          <label className="mt-2 flex items-center gap-2 text-slate-500"><input type="checkbox" name="removerFoto" className="accent-marca-900" /> tirar a foto</label>
        )}
        {erro && <p className="mt-1 text-red-700">{erro}</p>}
      </div>
    </div>
  );
}
