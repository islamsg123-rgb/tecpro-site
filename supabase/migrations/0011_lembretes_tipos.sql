-- Lembretes também para quem se matriculou e nunca abriu uma aula, e para quem começou
-- a inscrição e não terminou. Precisa do lembretes-estudo.sql rodado antes.
-- Rodar no Supabase: SQL Editor > New query > colar tudo e clicar em Run.
-- Pode rodar mais de uma vez sem problema.

alter table public.lembretes_estudo add column if not exists tipo text not null default 'parado';
-- parado = parou no meio do curso; nunca = matriculado que nunca abriu aula; interessado = inscrição não terminada
