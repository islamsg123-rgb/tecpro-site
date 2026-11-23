"use client";

import { useMemo, useState } from "react";
import type { Curso } from "@/lib/types";
import { CartaoCurso } from "./CartaoCurso";
import { IconeBusca } from "./Icones";

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function Catalogo({
  cursos,
  buscaInicial = "",
  categoriaInicial = "Todas",
}: {
  cursos: Curso[];
  buscaInicial?: string;
  categoriaInicial?: string;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [ordem, setOrdem] = useState("relevancia");

  const categorias = useMemo(
    () => ["Todas", ...Array.from(new Set(cursos.map((c) => c.categoria))).sort()],
    [cursos],
  );

  const termo = normalizar(busca.trim());
  const filtrados = cursos
    .filter((c) => (categoria === "Todas" || c.categoria === categoria) && (!termo || normalizar(`${c.nome} ${c.resumo}`).includes(termo)))
    .sort((a, b) =>
      ordem === "menor" ? a.precoCentavos - b.precoCentavos : ordem === "maior" ? b.precoCentavos - a.precoCentavos : ordem === "nome" ? a.nome.localeCompare(b.nome) : 0,
    );

  return (
    <div>
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <label className="flex flex-1 items-center gap-3 rounded-full bg-marca-50 px-5 py-3">
          <IconeBusca className="h-5 w-5 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar curso…"
            aria-label="Buscar curso"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </label>
        <select
          value={ordem}
          onChange={(e) => setOrdem(e.target.value)}
          aria-label="Ordenar cursos"
          className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
        >
          <option value="relevancia">Mais relevantes</option>
          <option value="menor">Menor preço</option>
          <option value="maior">Maior preço</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {categorias.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoria(cat)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              categoria === cat ? "bg-marca-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-marca-900"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm text-slate-500">
        {filtrados.length} {filtrados.length === 1 ? "curso encontrado" : "cursos encontrados"}
      </p>

      {filtrados.length ? (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <CartaoCurso key={c.id} curso={c} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          Nenhum curso encontrado. Tente outra palavra ou escolha “Todas”.
        </div>
      )}
    </div>
  );
}
