-- E-mails do certificado: parabéns para quem concluiu e não comprou, aviso "pagamento confirmado, emita"
-- e o certificado em PDF quando é emitido.
-- Rodar no Supabase: SQL Editor > New query > colar tudo e clicar em Run.
-- Pode rodar mais de uma vez sem problema.

create table if not exists public.lembretes_certificado (
  id             bigserial primary key,
  tipo           text not null check (tipo in ('comprar', 'emitir', 'entrega')),
  email          text not null,
  curso_id       text not null,
  curso_nome     text,
  nome           text,
  resend_id      text,                 -- id do e-mail no Resend (para cancelar o agendado)
  agendado_para  timestamptz,          -- quando o e-mail sai (ou saiu)
  status         text not null check (status in ('reservado', 'agendado', 'cancelado', 'enviado', 'erro')),
  detalhe        text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (tipo, email, curso_id)       -- cada e-mail sai no máximo 1 vez por aluno e curso
);
create index if not exists lembretes_certificado_criado_em on public.lembretes_certificado (criado_em desc);

alter table public.lembretes_certificado enable row level security;
grant select, insert, update, delete on public.lembretes_certificado to service_role;
grant usage, select on sequence public.lembretes_certificado_id_seq to service_role;
