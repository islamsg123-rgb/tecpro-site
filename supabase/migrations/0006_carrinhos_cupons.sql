-- Carrinhos (quem começou o checkout) e cupons de desconto.
-- Rodar no Supabase: SQL Editor > New query > colar e executar.

-- Uma linha por pessoa + produto. Guardada quando a pessoa preenche os dados de contato
-- e atualizada a cada etapa: contato -> pagamento (Pix/boleto gerado) -> pago / matriculado.
create table if not exists public.carrinhos (
  email           text not null,
  curso_id        text not null,
  tipo            text not null default 'curso' check (tipo in ('curso', 'certificado')),
  nome            text,
  telefone        text,
  etapa           text not null default 'contato' check (etapa in ('contato', 'pagamento', 'pago', 'matriculado')),
  forma           text,
  cobranca_id     text,
  valor_centavos  integer,
  cupom           text,
  contatado_em    timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  primary key (email, curso_id, tipo)
);

create table if not exists public.cupons (
  codigo         text primary key,                      -- sempre em maiúsculas
  tipo           text not null check (tipo in ('percentual', 'valor')),
  valor          integer not null check (valor > 0),    -- % (1 a 100) ou centavos
  aplica_em      text not null default 'tudo' check (aplica_em in ('tudo', 'cursos', 'certificados')),
  curso_id       text,                                  -- vazio = todos os cursos
  validade       date,                                  -- vazio = sem prazo
  limite_usos    integer,                               -- vazio = sem limite
  usos           integer not null default 0,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

alter table public.carrinhos enable row level security;
alter table public.cupons    enable row level security;
grant select, insert, update, delete on public.carrinhos, public.cupons to service_role;
