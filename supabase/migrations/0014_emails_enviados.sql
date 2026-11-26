-- Histórico de e-mails na ficha do aluno.
-- Cada e-mail que o site manda pelo Resend vira uma linha aqui (boas-vindas, link/código de acesso,
-- lembretes, certificado...). O Resend avisa o site (webhook) quando o e-mail é entregue, aberto,
-- clicado ou volta, e a linha é atualizada.
-- Rodar no Supabase: SQL Editor > New query > colar tudo e clicar em Run.
-- Pode rodar mais de uma vez sem problema.

create table if not exists public.emails_enviados (
  id             bigserial primary key,
  resend_id      text unique,               -- id do e-mail no Resend (vazio quando o envio falhou)
  email          text not null,             -- para quem foi
  tipo           text not null default 'outro',  -- boas_vindas, acesso, senha, lembrete, nunca_comecou, cert_parabens, cert_pdf, teste, equipe, outro
  assunto        text,
  curso_nome     text,
  status         text not null default 'enviado', -- agendado, enviado, entregue, atrasado, voltou, spam, falhou, cancelado, erro
  detalhe        text,                      -- motivo do erro / da volta
  agendado_para  timestamptz,
  entregue_em    timestamptz,
  aberto_em      timestamptz,               -- primeira abertura
  ultima_abertura timestamptz,
  aberturas      integer not null default 0,
  clicado_em     timestamptz,               -- primeiro clique
  cliques        integer not null default 0,
  links          jsonb not null default '[]'::jsonb, -- links clicados (sem repetir)
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists emails_enviados_email on public.emails_enviados (email, criado_em desc);

alter table public.emails_enviados enable row level security;
grant select, insert, update, delete on public.emails_enviados to service_role;
grant usage, select on sequence public.emails_enviados_id_seq to service_role;

-- Traz para o histórico os e-mails que já estavam anotados antes (lembretes e certificado).
insert into public.emails_enviados (email, tipo, assunto, curso_nome, status, detalhe, criado_em, atualizado_em)
select l.email,
       case when l.tipo = 'nunca' then 'nunca_comecou' else 'lembrete' end,
       l.etapa || 'º lembrete' || case when l.tipo = 'nunca' then ' (ainda não começou)' else ' de estudo' end,
       l.curso_nome, l.status, l.detalhe, l.enviado_em, l.enviado_em
from public.lembretes_estudo l
where not exists (
    select 1 from public.emails_enviados e
    where e.email = l.email and e.criado_em = l.enviado_em and e.tipo in ('lembrete', 'nunca_comecou')
  );

insert into public.emails_enviados (resend_id, email, tipo, assunto, curso_nome, status, detalhe, agendado_para, criado_em, atualizado_em)
select c.resend_id, c.email,
       case when c.tipo = 'comprar' then 'cert_parabens' else 'cert_pdf' end,
       case when c.tipo = 'comprar' then 'Parabéns pela conclusão' else 'Certificado em PDF' end,
       c.curso_nome,
       case c.status when 'reservado' then 'erro' else c.status end,
       c.detalhe, c.agendado_para, c.criado_em, c.atualizado_em
from public.lembretes_certificado c
where c.status <> 'reservado'
  and not exists (
    select 1 from public.emails_enviados e
    where (c.resend_id is not null and e.resend_id = c.resend_id)
       or (c.resend_id is null and e.email = c.email and e.criado_em = c.criado_em)
  )
on conflict (resend_id) do nothing;
