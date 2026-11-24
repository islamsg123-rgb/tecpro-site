-- Lembretes automáticos para alunos que pararam de estudar.
-- Rodar no Supabase: SQL Editor > New query > colar tudo e clicar em Run.
-- Pode rodar mais de uma vez sem problema.

-- Cada lembrete enviado (ou que deu erro), para o painel mostrar e para não repetir.
create table if not exists public.lembretes_estudo (
  id                bigserial primary key,
  email             text not null,
  nome              text,
  curso_id          text not null,
  curso_nome        text,
  etapa             integer not null,          -- 1º, 2º ou 3º lembrete
  dias_parado       integer not null,
  progresso_pct     integer,
  ultima_atividade  timestamptz not null,      -- quando o aluno estudou pela última vez (se voltar a estudar, a contagem recomeça)
  canal             text not null default 'email',
  status            text not null check (status in ('enviado', 'erro')),
  detalhe           text,
  enviado_em        timestamptz not null default now()
);
create index if not exists lembretes_estudo_enviado_em on public.lembretes_estudo (enviado_em desc);
create index if not exists lembretes_estudo_email on public.lembretes_estudo (email, curso_id);

-- Quem pediu para não receber mais lembretes (link no fim do e-mail).
create table if not exists public.lembretes_descadastro (
  email      text primary key,
  criado_em  timestamptz not null default now()
);

alter table public.lembretes_estudo      enable row level security;
alter table public.lembretes_descadastro enable row level security;
grant select, insert, update, delete on public.lembretes_estudo, public.lembretes_descadastro to service_role;
grant usage, select on sequence public.lembretes_estudo_id_seq to service_role;
