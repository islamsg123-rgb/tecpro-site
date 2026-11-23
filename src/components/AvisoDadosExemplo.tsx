import { usandoDadosDeExemplo } from "@/lib/escola-avancada/client";

export function AvisoDadosExemplo() {
  if (!usandoDadosDeExemplo) return null;
  return (
    <div className="bg-laranja-300 px-4 py-1.5 text-center text-xs font-medium text-marca-900">
      Versão de teste: os cursos são exemplos. Os reais aparecem quando a chave da API for configurada.
    </div>
  );
}
