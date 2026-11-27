-- "De onde vem o público" (painel > Online agora / Ver no Analytics):
-- uma linha por visita: cada navegador, em cada dia, por cada lugar de onde chegou (Google, Instagram, direto...).
-- Quem é da equipe não conta. Linhas com mais de 400 dias são apagadas sozinhas pelo painel.
-- Rodar no Supabase: SQL Editor > New query > colar tudo e clicar em Run.
-- Pode rodar mais de uma vez sem problema.

create table if not exists public.visitas_origem (
  dia          date not null,                 -- dia da visita (horário de Brasília)
  visitante    text not null,                 -- mesmo código do "Online agora"
  canal        text not null,                 -- google, instagram, facebook, whatsapp, youtube, tiktok, email, outro, direto
  anuncio      boolean not null default false,-- veio de anúncio pago
  campanha     text not null default '',      -- utm_campaign (ex.: qual e-mail do site)
  site         text not null default '',      -- quando é "outro site": qual (ex.: bing.com)
  entrada      text,                          -- primeira página aberta
  email        text,                          -- quem é, quando o site já sabe (para tirar a equipe)
  criado_em    timestamptz not null default now(),
  primary key (dia, visitante, canal, anuncio, campanha, site)
);
create index if not exists visitas_origem_dia on public.visitas_origem (dia desc);
create index if not exists visitas_origem_visitante on public.visitas_origem (visitante, criado_em desc);

alter table public.visitas_origem enable row level security;
grant select, insert, update, delete on public.visitas_origem to service_role;

-- Soma pronta para o painel (o banco conta tudo e devolve só o resumo).
create or replace function public.resumo_origens(p_desde date, p_excluir text[] default '{}')
returns jsonb
language sql
stable
set search_path = ''
as $$
  with v as (
    select * from public.visitas_origem
    where dia >= p_desde and (email is null or not (email = any (p_excluir)))
  )
  select jsonb_build_object(
    'visitas', (select count(*) from v),
    'pessoas', (select count(distinct visitante) from v),
    'grupos', coalesce((
      select jsonb_agg(g order by g.visitas desc) from (
        select canal, anuncio, campanha, site, count(*) as visitas, count(distinct visitante) as pessoas
        from v group by canal, anuncio, campanha, site
      ) g), '[]'::jsonb),
    'dias', coalesce((
      select jsonb_agg(d order by d.dia) from (
        select dia, canal, count(*) as visitas from v group by dia, canal
      ) d), '[]'::jsonb),
    'entradas', coalesce((
      select jsonb_agg(e order by e.visitas desc) from (
        select entrada, count(*) as visitas from v where entrada is not null group by entrada order by count(*) desc limit 50
      ) e), '[]'::jsonb)
  );
$$;
revoke all on function public.resumo_origens(date, text[]) from public, anon, authenticated;
grant execute on function public.resumo_origens(date, text[]) to service_role;
