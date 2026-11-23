-- Banco mínimo do site Tecpro. Cadastro e matrículas ficam na Escola Avançada (via API);
-- aqui guardamos só o que a API deles não recebe.
-- Rodar no Supabase: SQL Editor > New query > colar e executar.
-- O site acessa estas tabelas só pelo servidor (chave service_role). RLS ligado e sem regras
-- públicas: ninguém lê ou grava direto do navegador.

-- Liga o e-mail do login do site ao código do aluno na Escola Avançada.
create table if not exists public.alunos (
  email          text primary key,      -- sempre em minúsculas
  ea_usuario_id  text not null,
  nome           text,
  criado_em      timestamptz not null default now()
);

-- Aulas concluídas (as aulas passam no site da Tecpro; a Escola Avançada não fica sabendo).
create table if not exists public.progresso (
  email        text not null,
  curso_id     text not null,
  aula_id      text not null,
  concluida_em timestamptz not null default now(),
  primary key (email, curso_id, aula_id)
);

alter table public.alunos    enable row level security;
alter table public.progresso enable row level security;
