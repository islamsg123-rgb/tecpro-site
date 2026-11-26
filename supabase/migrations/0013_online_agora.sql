-- "Online agora" no painel: quem está no site neste momento (loja e área do aluno).
-- Cada aba aberta do site manda um sinal a cada minuto; quem mandou sinal nos últimos 2 minutos está online.
-- Uma linha por visitante (navegador). Linhas com mais de 30 dias são apagadas sozinhas pelo painel.
-- Rodar no Supabase: SQL Editor > New query > colar tudo e clicar em Run.
-- Pode rodar mais de uma vez sem problema.

create table if not exists public.presenca_site (
  visitante    text primary key,          -- código aleatório guardado no navegador
  email        text,                      -- quem é (aluno logado ou e-mail digitado no checkout); vazio = anônimo
  area         text not null check (area in ('loja', 'aluno')),
  pagina       text not null,             -- inicio, catalogo, curso, checkout, pagando, aula, certificado, conta, outra
  curso_slug   text,                      -- curso da página, quando tem
  primeira_em  timestamptz not null default now(),
  visto_em     timestamptz not null default now()
);
create index if not exists presenca_site_visto_em on public.presenca_site (visto_em desc);

alter table public.presenca_site enable row level security;
grant select, insert, update, delete on public.presenca_site to service_role;
