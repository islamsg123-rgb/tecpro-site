-- Painel completo: funcionários, pesquisa de satisfação, depoimentos,
-- dados extras do aluno e cursos removidos de um aluno pelo painel.
-- Rodar no Supabase: SQL Editor > New query > colar tudo e clicar em Run.
-- Pode rodar mais de uma vez sem problema.

-- Dados extras do aluno (editáveis na ficha do aluno no painel).
alter table public.alunos add column if not exists telefone    text;
alter table public.alunos add column if not exists cpf         text;
alter table public.alunos add column if not exists observacoes text;

-- Pessoas da equipe com acesso ao painel (além do dono, definido em ADMIN_EMAILS na Vercel).
create table if not exists public.funcionarios (
  email       text primary key,
  nome        text not null,
  permissoes  text[] not null default '{}',   -- seções liberadas: financeiro, vendas, alunos, cursos, loja, funcionarios
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Respostas da pesquisa de satisfação (botão opcional nas aulas).
create table if not exists public.pesquisas (
  id          bigserial primary key,
  email       text not null,
  nome        text,
  curso_id    text,
  curso_nome  text,
  aula_titulo text,
  nota        integer not null check (nota between 1 and 5),
  recomenda   integer check (recomenda between 0 and 10),
  comentario  text,
  criado_em   timestamptz not null default now()
);
create index if not exists pesquisas_criado_em on public.pesquisas (criado_em desc);

-- Depoimentos mostrados na página inicial.
create table if not exists public.depoimentos (
  id          bigserial primary key,
  nome        text not null,
  detalhe     text,           -- ex.: "Aluna de Auxiliar Administrativo"
  texto       text not null,
  foto        text,           -- foto já reduzida pelo painel (formato data:image/jpeg)
  ativo       boolean not null default true,
  ordem       integer not null default 0,
  criado_em   timestamptz not null default now()
);

-- Cursos tirados de um aluno pelo painel (o site deixa de mostrar o curso para ele).
create table if not exists public.cursos_removidos (
  email       text not null,
  curso_id    text not null,
  removido_em timestamptz not null default now(),
  removido_por text,
  primary key (email, curso_id)
);

alter table public.funcionarios     enable row level security;
alter table public.pesquisas        enable row level security;
alter table public.depoimentos      enable row level security;
alter table public.cursos_removidos enable row level security;
grant select, insert, update, delete on public.funcionarios, public.pesquisas, public.depoimentos, public.cursos_removidos to service_role;
grant usage, select on all sequences in schema public to service_role;
