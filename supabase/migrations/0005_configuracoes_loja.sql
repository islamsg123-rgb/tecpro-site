-- Configurações gerais da loja, editáveis no painel (/admin/configuracoes).
create table if not exists public.configuracoes_loja (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.configuracoes_loja enable row level security;
grant select, insert, update, delete on public.configuracoes_loja to service_role;
