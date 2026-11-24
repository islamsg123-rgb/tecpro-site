-- Cidade e estado do aluno (pedidos no cadastro dos cursos gratuitos).
alter table public.alunos add column if not exists cidade text;
alter table public.alunos add column if not exists estado text;
