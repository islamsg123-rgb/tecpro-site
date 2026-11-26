-- 2º e 3º aviso para quem concluiu o curso e ainda não emitiu o certificado.
-- Só deixa a tabela lembretes_certificado aceitar os dois tipos novos (comprar2 e comprar3).
-- Rodar no Supabase: SQL Editor > New query > colar tudo e clicar em Run.
-- Pode rodar mais de uma vez sem problema.

alter table public.lembretes_certificado drop constraint if exists lembretes_certificado_tipo_check;
alter table public.lembretes_certificado
  add constraint lembretes_certificado_tipo_check check (tipo in ('comprar', 'comprar2', 'comprar3', 'entrega'));
