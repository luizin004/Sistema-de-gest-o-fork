-- =====================================================
-- Configurar Cron Job para campanha-scheduler (1 a cada 2 minutos)
-- =====================================================

DO $$
DECLARE
  job_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname = 'processar-fila-mensagens'
  ) INTO job_exists;

  IF job_exists THEN
    PERFORM cron.unschedule('processar-fila-mensagens');
    RAISE NOTICE 'Job processar-fila-mensagens removido com sucesso.';
  ELSE
    RAISE NOTICE 'Job processar-fila-mensagens não encontrado, seguindo...';
  END IF;
END
$$;

-- 2. Criar novo job para rodar a cada 2 minutos
SELECT cron.schedule(
  'campanha-disparos-um-por-minuto',
  '*/2 * * * *',  -- A cada 2 minutos
  $$
  SELECT net.http_post(
    url := 'https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/campanha-scheduler',
    headers := '{
      "Content-Type": "application/json",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmhvYnF0dGsiLCJpYXQiOjE3MzU5MDQ0NzYsImV4cCI6MjA1MTQ4MDQ3Nn0.qhz3xW8nTq7kxL6Z9XqFqHwL5vR8sK2mM1pN7qO6xK4"
    }'::jsonb,
    body := '{}'
  );
  $$
);

-- 3. Verificar se o job foi criado
SELECT * FROM cron.job WHERE jobname = 'campanha-disparos-um-por-minuto';

-- 4. Adicionar índice para performance (se não existir)
CREATE INDEX IF NOT EXISTS idx_tabela_campanha_pendentes 
ON tabela_campanha (disparo_feito, criado_em)
WHERE disparo_feito = false;

-- 5. Verificar leads pendentes
SELECT COUNT(*) as leads_pendentes 
FROM tabela_campanha 
WHERE disparo_feito = false;
