import Link from "next/link";
import { emitir, usarCreditoCertificado } from "@/app/minha-conta/acoes";
import { formatarPreco } from "@/lib/formatar";
import type { SituacaoCertificado } from "@/lib/certificados";
import { IconeCadeado, IconeCertificado, IconeCheck } from "../Icones";

export function CartaoCertificado({
  s, slug, faltam, nomeSugerido, erroNome, creditos = 0,
}: {
  s: SituacaoCertificado;
  slug: string;
  faltam: number;
  nomeSugerido: string;
  erroNome?: boolean;
  /** Certificados que sobraram de pacotes comprados */
  creditos?: number;
}) {
  const pago = s.regra.modo === "pago";
  return (
    <aside id="certificado" className="h-fit scroll-mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="bg-marca-900 p-6 text-white">
        <IconeCertificado className="h-8 w-8 text-laranja-500" />
        <h2 className="mt-3 text-lg font-bold">Certificado</h2>
        <p className="mt-1 text-sm text-slate-300">
          {/* O valor do certificado pago só aparece depois que o aluno conclui o curso. */}
          {!pago
            ? "Grátis ao concluir o curso"
            : s.estado === "aguardando_pagamento" && s.regra.modo === "pago"
              ? creditos > 0 ? "Use um certificado do seu pacote" : `A partir de ${formatarPreco(s.regra.precoCentavos)}`
              : "Disponível ao concluir o curso"}
        </p>
      </div>
      <div className="p-6">
        {s.estado === "em_andamento" && (
          <p className="flex gap-3 text-sm text-slate-600">
            <IconeCadeado className="h-5 w-5 shrink-0 text-slate-400" />
            Conclua todas as aulas para liberar. {faltam === 1 ? "Falta 1 aula." : `Faltam ${faltam} aulas.`}
          </p>
        )}

        {s.estado === "aguardando_pagamento" && s.regra.modo === "pago" && (
          <>
            <p className="text-sm text-slate-600">Parabéns, você concluiu o curso!</p>
            {creditos > 0 ? (
              <form action={usarCreditoCertificado} className="mt-4">
                <input type="hidden" name="slug" value={slug} />
                <p className="text-sm text-slate-600">
                  Você tem <strong className="text-marca-900">{creditos} {creditos === 1 ? "certificado disponível" : "certificados disponíveis"}</strong> do seu pacote.
                </p>
                <button className="mt-4 w-full rounded-full bg-green-600 py-3.5 font-bold text-white hover:bg-green-700">Usar 1 e liberar</button>
              </form>
            ) : (
              <Link href={`/minha-conta/cursos/${slug}/certificado`} className="mt-5 block rounded-full bg-laranja-500 py-3.5 text-center font-bold text-marca-900 hover:bg-laranja-400">
                Emitir certificado
              </Link>
            )}
          </>
        )}

        {s.estado === "disponivel" && (
          <form action={emitir} className="space-y-3">
            <p className="text-sm text-slate-600">Tudo pronto! Confira como o seu nome deve aparecer. Depois de emitido, ele não pode ser alterado.</p>
            <input type="hidden" name="slug" value={slug} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Nome completo no certificado</span>
              <input name="nome" defaultValue={nomeSugerido} required className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100" />
            </label>
            {erroNome && <p className="text-xs font-medium text-red-600">Informe nome e sobrenome.</p>}
            <button className="w-full rounded-full bg-laranja-500 py-3.5 font-bold text-marca-900 hover:bg-laranja-400">Emitir certificado</button>
          </form>
        )}

        {s.estado === "emitido" && s.certificado && (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-green-700"><IconeCheck className="h-5 w-5" /> Certificado emitido</p>
            <p className="mt-2 text-sm text-slate-600">{s.certificado.nomeAluno}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">{s.certificado.codigo}</p>
            <a href={`/certificados/${s.certificado.codigo}/pdf`} target="_blank" rel="noopener" className="mt-5 block rounded-full bg-marca-900 py-3.5 text-center font-bold text-white hover:bg-marca-800">
              Baixar certificado (PDF)
            </a>
            <Link href={`/validar/${s.certificado.codigo}`} className="mt-3 block text-center text-sm font-semibold text-marca-700 hover:underline">
              Ver página de validação
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
