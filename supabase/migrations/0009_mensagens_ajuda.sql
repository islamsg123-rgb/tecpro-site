-- Mensagens do botão de ajuda (bolinha no canto da tela do site e da área do aluno).
-- Rodar no Supabase: SQL Editor > New query > colar tudo e clicar em Run.
-- Pode rodar mais de uma vez sem problema.

create table if not exists public.mensagens_ajuda (
  id            bigserial primary key,
  origem        text not null check (origem in ('aluno', 'loja')),  -- aluno = enviada de dentro da área do aluno; loja = vitrine
  tipo          text not null,           -- erro no site, vídeo, pagamento, certificado, acesso, outro
  mensagem      text not null,
  nome          text,
  email         text,
  telefone      text,
  logado        boolean not null default false,  -- a pessoa estava com login feito
  pagina        text,                    -- endereço da página de onde mandou
  curso_nome    text,
  aula_titulo   text,
  navegador     text,                    -- aparelho/navegador (ajuda a achar o erro)
  print         text,                    -- imagem opcional, já reduzida (data:image/jpeg)
  ip_hash       text,                    -- só para limitar envios repetidos (não guarda o IP)
  status        text not null default 'nova' check (status in ('nova', 'resolvida')),
  anotacao      text,                    -- anotação interna da equipe
  resolvida_em  timestamptz,
  resolvida_por text,
  criado_em     timestamptz not null default now()
);
-- Só para a lista do painel saber se há imagem sem precisar baixá-la.
alter table public.mensagens_ajuda add column if not exists tem_print boolean generated always as (print is not null) stored;

create index if not exists mensagens_ajuda_criado_em on public.mensagens_ajuda (criado_em desc);
create index if not exists mensagens_ajuda_ip on public.mensagens_ajuda (ip_hash, criado_em desc);

alter table public.mensagens_ajuda enable row level security;
grant select, insert, update, delete on public.mensagens_ajuda to service_role;
grant usage, select on sequence public.mensagens_ajuda_id_seq to service_role;
