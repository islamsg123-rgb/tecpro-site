"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Menu do painel: uma barra fina com ícones na lateral, que abre ao passar o mouse.
 * No celular, vira um botão "Menu" que abre a lista por cima da página.
 * Também mostra as abas da seção aberta no topo da página.
 */

export type Secao = "painel" | "financeiro" | "vendas" | "alunos" | "cursos" | "loja" | "funcionarios" | "mensagens" | "sistema";
/** Números de "novas" mostrados ao lado do item do menu, pelo endereço (ex.: mensagens novas). */
export type Contadores = Record<string, number>;

interface Item {
  secao: Secao;
  rotulo: string;
  href: string;
  icone: React.ReactNode;
  sub?: { rotulo: string; href: string }[];
}

const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 shrink-0" aria-hidden>
    {d}
  </svg>
);

export const MENU: Item[] = [
  { secao: "painel", rotulo: "Painel rápido", href: "/admin", icone: svg(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>) },
  {
    secao: "financeiro", rotulo: "Financeiro", href: "/admin/financeiro/hoje",
    icone: svg(<><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></>),
    sub: [
      { rotulo: "Hoje", href: "/admin/financeiro/hoje" },
      { rotulo: "Resumo do mês", href: "/admin/financeiro" },
      { rotulo: "Extrato de vendas", href: "/admin/financeiro/recebimentos" },
      { rotulo: "Recuperar vendas", href: "/admin/financeiro/devedores" },
      { rotulo: "De onde vêm as vendas", href: "/admin/financeiro/origem" },
      { rotulo: "Taxas e prazos", href: "/admin/financeiro/taxas" },
    ],
  },
  {
    secao: "vendas", rotulo: "Vendas", href: "/admin/carrinhos",
    icone: svg(<><path d="M3 4h2l2.4 11h10.2L20 8H6.2" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>),
    sub: [
      { rotulo: "Carrinhos abandonados", href: "/admin/carrinhos" },
      { rotulo: "Cupons de desconto", href: "/admin/cupons" },
    ],
  },
  {
    secao: "alunos", rotulo: "Alunos", href: "/admin/alunos",
    icone: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.3 0 4 1.5 4.5 4" /></>),
    sub: [
      { rotulo: "Todos os alunos", href: "/admin/alunos" },
      { rotulo: "Progresso", href: "/admin/alunos/ranking" },
      { rotulo: "Lembretes de estudo", href: "/admin/lembretes" },
      { rotulo: "Formados", href: "/admin/alunos/formados" },
      { rotulo: "Certificados", href: "/admin/certificados" },
      { rotulo: "Pesquisa de satisfação", href: "/admin/pesquisa" },
      { rotulo: "Cadastrar aluno", href: "/admin/alunos/novo" },
    ],
  },
  { secao: "cursos", rotulo: "Cursos", href: "/admin/cursos", icone: svg(<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /><path d="M9 7.5h7" /></>) },
  {
    secao: "loja", rotulo: "Loja virtual", href: "/admin/loja/depoimentos",
    icone: svg(<><path d="M3 9.5 4.5 4h15L21 9.5" /><path d="M3 9.5c0 1.4 1.1 2.5 2.5 2.5S8 10.9 8 9.5c0 1.4 1.1 2.5 2.5 2.5h3c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S21 10.9 21 9.5" /><path d="M5 12v8h14v-8M10 20v-4h4v4" /></>),
    sub: [
      { rotulo: "Depoimentos", href: "/admin/loja/depoimentos" },
      { rotulo: "Configurações da loja", href: "/admin/configuracoes" },
    ],
  },
  {
    secao: "mensagens", rotulo: "Mensagens", href: "/admin/mensagens",
    icone: svg(<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z" /><path d="M8 8.5h8M8 11.5h5" /></>),
    sub: [
      { rotulo: "Suporte", href: "/admin/mensagens" },
      { rotulo: "E-mails", href: "/admin/mensagens/emails" },
    ],
  },
  { secao: "funcionarios", rotulo: "Funcionários", href: "/admin/funcionarios", icone: svg(<><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="2.8" /><path d="M7.5 17.5c.7-2 2.5-3.2 4.5-3.2s3.8 1.2 4.5 3.2" /></>) },
  { secao: "sistema", rotulo: "Integrações", href: "/admin/integracoes", icone: svg(<><path d="M9 15 15 9" /><path d="M11 6.5 12.5 5a3.5 3.5 0 0 1 5 5L16 11.5M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5" /></>) },
  { secao: "sistema", rotulo: "Conexão (API)", href: "/admin/diagnostico", icone: svg(<><path d="M9 7 4 12l5 5M15 7l5 5-5 5" /></>) },
];

/**
 * O painel tem duas áreas, trocadas pela chave no topo: Gestão (alunos, cursos, equipe) e Financeiro (dinheiro).
 * O login e o sistema são um só; cada área mostra só os itens dela no menu.
 */
export type Area = "gestao" | "financeiro";
const SECOES_FINANCEIRO: Secao[] = ["financeiro", "vendas"];
export const areaDaSecao = (s: Secao): Area => (SECOES_FINANCEIRO.includes(s) ? "financeiro" : "gestao");
export const NOME_AREA: Record<Area, string> = { gestao: "Painel de Gestão", financeiro: "Painel Financeiro" };

/** Área da página aberta (pelo endereço). */
export function areaDoCaminho(pathname: string): Area {
  const fin = MENU.filter((m) => areaDaSecao(m.secao) === "financeiro");
  return ativo(pathname, fin) ? "financeiro" : "gestao";
}

/** Quem tem acesso às duas áreas vê a chave; o menu mostra só a área aberta. */
export function temDuasAreas(secoes: Secao[]) {
  return secoes.some((s) => areaDaSecao(s) === "financeiro") && secoes.some((s) => s !== "painel" && areaDaSecao(s) === "gestao");
}

function itensDaArea(secoes: Secao[], pathname: string) {
  const todos = MENU.filter((m) => secoes.includes(m.secao));
  if (!temDuasAreas(secoes)) return todos;
  const area = areaDoCaminho(pathname);
  return todos.filter((m) => areaDaSecao(m.secao) === area);
}

/** Item (e sub-item) que corresponde à página aberta. */
function ativo(pathname: string, itens: Item[]) {
  let melhor: { item: Item; href: string } | null = null;
  for (const item of itens) {
    for (const h of [item.href, ...(item.sub?.map((s) => s.href) ?? [])]) {
      const casa = h === "/admin" ? pathname === "/admin" : pathname === h || pathname.startsWith(`${h}/`);
      if (casa && (!melhor || h.length > melhor.href.length)) melhor = { item, href: h };
    }
  }
  return melhor;
}

const Bolinha = ({ n, className = "" }: { n?: number; className?: string }) =>
  n ? <span className={`grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white ${className}`} aria-label={`${n} novas`}>{n > 99 ? "99+" : n}</span> : null;

export function MenuLateral({ secoes, email, sair, contadores = {} }: { secoes: Secao[]; email: string; sair: React.ReactNode; contadores?: Contadores }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [pathname]);
  // Celular: a tecla Esc também fecha o menu
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberto]);
  const itens = itensDaArea(secoes, pathname);
  const fin = temDuasAreas(secoes) && areaDoCaminho(pathname) === "financeiro";
  // Cor da área: laranja na Gestão, verde no Financeiro.
  const corAtivo = fin ? "bg-emerald-400 text-neutral-950" : "bg-laranja-500 text-marca-900";
  const corSubAtivo = fin ? "text-emerald-300" : "text-laranja-400";
  const atual = ativo(pathname, itens);
  const titulo = temDuasAreas(secoes) ? NOME_AREA[areaDoCaminho(pathname)] : secoes.some((s) => areaDaSecao(s) === "gestao" && s !== "painel") ? NOME_AREA.gestao : "Painel Tecpro";

  const lista = (expandido: boolean) => (
    <ul className="space-y-1" onClick={(e) => (e.target as HTMLElement).closest("a") && setAberto(false)}>
      {itens.map((m) => {
        const eAtual = atual?.item === m;
        const total = m.sub ? m.sub.reduce((t, x) => t + (contadores[x.href] ?? 0), 0) : contadores[m.href] ?? 0;
        return (
          <li key={m.href}>
            <Link
              href={m.href}
              title={m.rotulo}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${eAtual ? corAtivo : "text-white/80 hover:bg-white/10 hover:text-white"}`}
            >
              <span className="relative">
                {m.icone}
                {!expandido && <Bolinha n={total} className="absolute -right-2 -top-2 group-hover:hidden" />}
              </span>
              <span className={`flex flex-1 items-center justify-between gap-2 whitespace-nowrap ${expandido ? "" : "opacity-0 transition-opacity duration-150 group-hover:opacity-100"}`}>
                {m.rotulo}
                <Bolinha n={total} />
              </span>
            </Link>
            {m.sub && (
              <ul className={`ml-12 mt-1 space-y-0.5 ${expandido ? "" : "hidden group-hover:block"}`}>
                {m.sub.map((s) => (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${atual?.href === s.href ? corSubAtivo : "text-white/60 hover:text-white"}`}
                    >
                      {s.rotulo}
                      <Bolinha n={contadores[s.href]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Computador: barra recolhida que abre ao passar o mouse */}
      <aside className="sticky top-[59px] z-20 hidden h-[calc(100vh-59px)] w-[72px] shrink-0 md:block print:hidden">
        <nav
          aria-label="Menu do painel"
          className="group absolute inset-y-0 left-0 flex w-[72px] flex-col overflow-y-auto overflow-x-hidden bg-neutral-950 px-3 py-4 transition-[width,box-shadow] duration-200 hover:w-72 hover:shadow-2xl focus-within:w-72"
        >
          <div className="mb-5 flex h-9 items-center gap-3 px-1">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold ${fin ? "bg-emerald-400 text-neutral-950" : "bg-laranja-500 text-marca-900"}`}>{fin ? "R$" : "G"}</span>
            <span className="whitespace-nowrap text-sm font-bold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">{titulo}</span>
          </div>
          {lista(false)}
          <div className="mt-auto pt-6 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="truncate px-3 text-xs text-white/50">{email}</p>
            <div className="mt-2 px-3">{sair}</div>
          </div>
        </nav>
      </aside>

      {/* Celular: botão que abre o menu */}
      <div className="sticky top-[59px] z-20 flex items-center justify-between border-t border-white/10 bg-neutral-900 px-4 py-3 md:hidden print:hidden">
        <span className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${fin ? "text-emerald-300" : "text-laranja-500"}`}>{titulo} <Bolinha n={Object.values(contadores).reduce((a, b) => a + b, 0)} /></span>
        <button onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white">
          {aberto ? "Fechar" : "Menu"}
        </button>
      </div>
      {aberto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-950 px-4 py-4 md:hidden">
          <div className="mb-4 flex items-center justify-between">
            <span className={`text-sm font-bold uppercase tracking-wider ${fin ? "text-emerald-300" : "text-laranja-500"}`}>{titulo}</span>
            <button onClick={() => setAberto(false)} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white">Fechar</button>
          </div>
          {lista(true)}
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="truncate px-3 text-xs text-white/50">{email}</p>
            <div className="mt-2 px-3">{sair}</div>
          </div>
        </div>
      )}
    </>
  );
}

/** Abas da seção aberta (ex.: Financeiro > Resumo | Matrículas e recebimentos | Recuperar vendas). */
export function AbasSecao({ secoes, contadores = {} }: { secoes: Secao[]; contadores?: Contadores }) {
  const pathname = usePathname();
  const atual = ativo(pathname, MENU.filter((m) => secoes.includes(m.secao)));
  if (!atual?.item.sub) return null;
  const sublinhado = temDuasAreas(secoes) && areaDoCaminho(pathname) === "financeiro" ? "border-emerald-500" : "border-laranja-500";
  return (
    <nav aria-label={atual.item.rotulo} className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
      {atual.item.sub.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${atual.href === s.href ? `${sublinhado} text-marca-900` : "border-transparent text-slate-500 hover:text-marca-900"}`}
        >
          {s.rotulo}
          <Bolinha n={contadores[s.href]} />
        </Link>
      ))}
    </nav>
  );
}
