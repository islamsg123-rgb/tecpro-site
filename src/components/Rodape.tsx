import Link from "next/link";
import { Logo } from "./Logo";
import { obterConfigLoja } from "@/lib/dados";

export async function Rodape() {
  const loja = await obterConfigLoja().catch(() => null);
  const zap = loja?.whatsapp.replace(/\D/g, "") ?? "";
  const insta = loja?.instagram.replace(/^@/, "") ?? "";
  return (
    <footer className="bg-marca-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo altura={44} />
          <p className="mt-5 max-w-xs text-sm leading-relaxed">
            Cursos livres, profissionalizantes, certificação por competência e EJA. Aprenda no seu ritmo, de onde estiver.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Cursos</p>
          <ul className="mt-4 space-y-3">
            <li><Link href="/cursos" className="hover:text-white">Todos os cursos</Link></li>
            <li><Link href="/#certificado" className="hover:text-white">Certificado</Link></li>
            <li><Link href="/validar" className="hover:text-white">Validar certificado</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Aluno</p>
          <ul className="mt-4 space-y-3">
            <li><Link href="/minha-conta" className="hover:text-white">Área do aluno</Link></li>
            <li><Link href="/#duvidas" className="hover:text-white">Dúvidas frequentes</Link></li>
            <li><Link href="/termos" className="hover:text-white">Termos de uso</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Atendimento</p>
          {/* Contatos editáveis no painel: Loja virtual > Configurações da loja */}
          <ul className="mt-4 space-y-3">
            {zap && <li><a href={`https://wa.me/${zap.length <= 11 ? `55${zap}` : zap}`} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp: {loja!.whatsapp}</a></li>}
            {loja?.emailContato && <li><a href={`mailto:${loja.emailContato}`} className="hover:text-white">{loja.emailContato}</a></li>}
            {insta && <li><a href={`https://instagram.com/${insta}`} target="_blank" rel="noreferrer" className="hover:text-white">Instagram: @{insta}</a></li>}
            {!zap && !loja?.emailContato && !insta && <li>contato@tecpromultiensino.com.br</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Tecpro Multi Ensino. Todos os direitos reservados.</p>
          <p>Pagamento seguro · Pix, boleto e cartão</p>
        </div>
      </div>
    </footer>
  );
}
