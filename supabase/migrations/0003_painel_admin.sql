-- Ajustes feitos pelo painel de administração, por curso.
-- Os cursos em si (nome, descrição, aulas) continuam vindo da Escola Avançada.
create table if not exists public.configuracoes_curso (
  curso_id                    text primary key,
  preco_centavos              integer check (preco_centavos is null or preco_centavos >= 500), -- vazio = preço da Escola Avançada
  visivel                     boolean not null default true,
  destaque                    boolean not null default false,
  certificado_modo            text check (certificado_modo in ('gratis', 'pago')),            -- vazio = padrão (grátis)
  certificado_preco_centavos  integer check (certificado_preco_centavos is null or certificado_preco_centavos >= 500),
  atualizado_em               timestamptz not null default now()
);
alter table public.configuracoes_curso enable row level security;
