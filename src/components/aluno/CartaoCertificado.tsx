import Link from "next/link";
import { emitir, usarCreditoCertificado } from "@/app/minha-conta/acoes";
import { formatarPreco } from "@/lib/formatar";
import type { SituacaoCertificado } from "@/lib/certificados";
import { IconeCadeado, IconeCertificado, IconeCheck } from "../Icones";
import { BotaoAbrirAjuda } from "../ajuda/BotaoAbrirAjuda";

export function CartaoCertificado({
  s, slug, faltam, nomeSugerido, erroNome, creditos = 0, emailSuporte = "", email = "", cursoNome = "",
}: {
  s: SituacaoCertificado;
  slug: string;
  faltam: number;
  nomeSugerido: string;
  erroNome?: boolean;
  /** Certificados que sobraram de pacotes comprados */
  creditos?: number;
  /** E-mail da escola (Configurações da loja), para pedir correção do nome */
  emailSuporte?: string;
  email?: string;
  cursoNome?: string;
}) {
  // Correção do nome: só pelo botão de ajuda do site ou por e-mail (sem WhatsApp da escola).
  const textoNomeErrado = `Concluí o curso ${cursoNome} e o meu nome está errado no certificado. Meu cadastro: ${nomeSugerido || "(sem nome)"}, ${email}. Nome correto: `;
  const emailEscola = emailSuporte || "contato@tecpromultiensino.com.br";
  const linkEmail = `mailto:${emailEscola}?subject=${encodeURIComponent("Correção do nome no certificado")}&body=${encodeURIComponent(`Olá! ${textoNomeErrado}`)}`;
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
              : s.estado === "disponivel"
                ? "Pagamento confirmado, pronto para emitir"
                : s.estado === "emitido"
                  ? "Certificado emitido"
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
<div className="space-y-3">
            <p className="text-sm text-slate-600">Tudo pronto! O certificado sai com o nome do seu cadastro:</p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-marca-900">{nomeSugerido || "Nome não cadastrado"}</p>
            {nomeSugerido.trim().split(/\s+/).length >= 2 && (
              <form action={emitir}>
                <input type="hidden" name="slug" value={slug} />
                <button className="w-full rounded-full bg-laranja-500 py-3.5 font-bold text-marca-900 hover:bg-laranja-400">Está certo, emitir certificado</button>
              </form>
            )}
            {erroNome && <p className="text-xs font-medium text-red-600">Seu cadastro está sem nome completo. Fale com o suporte para corrigir.</p>}
            <p className="text-xs text-slate-500">Depois de emitido, o certificado não pode ser alterado. Se o nome estiver errado, fale com o suporte: confirmamos a sua identidade e corrigimos para você.</p>
            <BotaoAbrirAjuda tipo="certificado" mensagem={textoNomeErrado} className="block w-full rounded-full border border-marca-900 py-3 text-center font-semibold text-marca-900 hover:bg-slate-50">
              Nome errado? Falar com o suporte
            </BotaoAbrirAjuda>
            <a href={linkEmail} className="block text-center text-xs text-slate-500 underline">ou escreva para {emailEscola}</a>
          </div>
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
