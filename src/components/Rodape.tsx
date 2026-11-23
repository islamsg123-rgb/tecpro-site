import Link from "next/link";
import { Logo } from "./Logo";

export function Rodape() {
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
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Aluno</p>
          <ul className="mt-4 space-y-3">
            <li><Link href="/minha-conta" className="hover:text-white">Área do aluno</Link></li>
            <li><Link href="/#duvidas" className="hover:text-white">Dúvidas frequentes</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Atendimento</p>
          {/* SUPOSIÇÃO: trocar pelos contatos reais da Tecpro */}
          <ul className="mt-4 space-y-3">
            <li>WhatsApp: (00) 00000-0000</li>
            <li>contato@tecpromultiensino.com.br</li>
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
