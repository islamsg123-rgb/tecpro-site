-- Certificados emitidos pelo site (a API da Escola Avançada não emite certificado).

-- Certificados pagos e ainda não emitidos (ou já emitidos): libera a emissão quando o certificado é pago.
create table if not exists public.certificados_pagos (
  email        text not null,
  curso_id     text not null,
  cobranca_id  text not null,
  pago_em      timestamptz not null default now(),
  primary key (email, curso_id)
);

-- Certificados emitidos. O código é o que aparece no PDF e na página pública de validação.
create table if not exists public.certificados (
  codigo         text primary key,
  email          text not null,
  curso_id       text not null,
  nome_aluno     text not null,
  curso_nome     text not null,
  carga_horaria  integer not null,
  emitido_em     timestamptz not null default now(),
  unique (email, curso_id)
);

alter table public.certificados_pagos enable row level security;
alter table public.certificados       enable row level security;
