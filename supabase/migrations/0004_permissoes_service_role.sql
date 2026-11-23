-- Projetos novos do Supabase não dão acesso automático às tabelas criadas por SQL.
-- O site usa só a chave secreta (service_role), no servidor. Damos acesso apenas a ela;
-- anon/authenticated continuam sem acesso (RLS ligado e sem políticas).
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
