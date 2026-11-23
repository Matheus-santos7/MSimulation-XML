-- S-4 da auditoria: guarda o passo TOTP aceito no login para recusar o mesmo código de novo
-- (replay). `users` é tabela de autenticação e fica fora da RLS por decisão do projeto.
ALTER TABLE "users" ADD COLUMN "totp_last_time_step" INTEGER;
