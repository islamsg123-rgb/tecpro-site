import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { Titulo } from "@/components/admin/Blocos";

export const metadata: Metadata = { title: "Integrações" };
export const dynamic = "force-dynamic";

/**
 * Atalhos para os sites que fazem o site da Tecpro funcionar.
 * Só links: nenhuma chave ou senha aparece aqui (elas ficam guardadas na Vercel).
 */

interface Integracao {
  nome: string;
  sigla: string;
  cor: string;
  oQueFaz: string;
  ondeMexer: string[];
  links: { rotulo: string; href: string }[];
}

const INTEGRACOES: Integracao[] = [
  {
    nome: "Vercel",
    sigla: "▲",
    cor: "bg-black text-white",
    oQueFaz: "Onde o site fica no ar. Cada atualização aprovada é publicada por aqui.",
    ondeMexer: ["Chaves do site: projeto tecpro-site › Settings › Environment Variables", "Publicações: aba Deployments"],
    links: [{ rotulo: "Abrir a Vercel", href: "https://vercel.com/dashboard" }],
  },
  {
    nome: "Supabase",
    sigla: "S",
    cor: "bg-emerald-500 text-white",
    oQueFaz: "Banco de dados e login dos alunos e administradores (link por e-mail e senha).",
    ondeMexer: ["Rodar SQL: SQL Editor", "Contas de login: Authentication › Users", "Endereços do site: Authentication › URL Configuration"],
    links: [{ rotulo: "Abrir o Supabase", href: "https://supabase.com/dashboard/projects" }],
  },
  {
    nome: "Resend",
    sigla: "R",
    cor: "bg-slate-900 text-white",
    oQueFaz: "Envia os e-mails do site: boas-vindas, link de acesso e troca de senha.",
    ondeMexer: ["E-mails enviados: Emails", "Domínio tecpromultiensino.com.br: Domains"],
    links: [
      { rotulo: "E-mails enviados", href: "https://resend.com/emails" },
      { rotulo: "Domínios", href: "https://resend.com/domains" },
    ],
  },
  {
    nome: "Mercado Pago",
    sigla: "MP",
    cor: "bg-sky-500 text-white",
    oQueFaz: "Recebe os pagamentos do checkout: cartão em até 12x, Pix e boleto.",
    ondeMexer: ["Vendas e saldo: painel da conta", "Credenciais e webhook: Suas integrações (desenvolvedores)"],
    links: [
      { rotulo: "Painel da conta", href: "https://www.mercadopago.com.br/home" },
      { rotulo: "Desenvolvedores", href: "https://www.mercadopago.com.br/developers/panel/app" },
    ],
  },
  {
    nome: "Asaas",
    sigla: "A",
    cor: "bg-blue-600 text-white",
    oQueFaz: "Sistema de pagamento reserva. Pode ser escolhido em Configurações da loja.",
    ondeMexer: ["Conta real: asaas.com", "Conta de testes: sandbox.asaas.com"],
    links: [
      { rotulo: "Conta real", href: "https://www.asaas.com/login" },
      { rotulo: "Conta de testes", href: "https://sandbox.asaas.com/login" },
    ],
  },
  {
    nome: "Escola Avançada",
    sigla: "EA",
    cor: "bg-laranja-500 text-marca-900",
    oQueFaz: "Plataforma parceira de onde vêm os cursos, as aulas e as matrículas dos alunos.",
    ondeMexer: ["Alunos, cursos e gabaritos: painel administrativo da EA"],
    links: [{ rotulo: "Abrir o painel da EA", href: "https://curso.eadaulas.com/tecpromultiensino/index.php" }],
  },
  {
    nome: "GoDaddy",
    sigla: "GD",
    cor: "bg-teal-600 text-white",
    oQueFaz: "Onde o domínio tecpromultiensino.com.br está registrado (DNS).",
    ondeMexer: ["Meus produtos › tecpromultiensino.com.br › DNS"],
    links: [{ rotulo: "Abrir a GoDaddy", href: "https://dcc.godaddy.com/control/portfolio" }],
  },
  {
    nome: "GitHub",
    sigla: "GH",
    cor: "bg-marca-900 text-white",
    oQueFaz: "Onde fica o código do site. As atualizações chegam aqui antes de ir para a Vercel.",
    ondeMexer: ["Atualizações aguardando aprovação: Pull requests"],
    links: [{ rotulo: "Abrir o código", href: "https://github.com/islamsg123-rgb/tecpro-site" }],
  },
];

export default async function Integracoes() {
  if (!(await exigirAdmin()).dono) notFound();
  return (
    <>
      <Titulo descricao="Atalhos para os sites que fazem a Tecpro funcionar. Cada botão abre o site em uma nova aba; você entra com o seu login de cada um. Por segurança, nenhuma chave ou senha fica nesta página.">
        Integrações
      </Titulo>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRACOES.map((i) => (
          <section key={i.nome} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold ${i.cor}`} aria-hidden>
                {i.sigla}
              </span>
              <h2 className="text-lg font-bold text-marca-900">{i.nome}</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600">{i.oQueFaz}</p>
            <ul className="mt-3 flex-1 space-y-1 text-xs text-slate-500">
              {i.ondeMexer.map((o) => (
                <li key={o} className="flex gap-2"><span className="text-laranja-500">•</span>{o}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {i.links.map((l, n) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${n === 0 ? "bg-marca-900 text-white hover:bg-marca-800" : "border border-slate-300 text-marca-900 hover:border-marca-900"}`}
                >
                  {l.rotulo}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
