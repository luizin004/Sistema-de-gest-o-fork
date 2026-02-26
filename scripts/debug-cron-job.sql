-- Verificar qual função o cron job está executando
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'mover-leads-nao-respondeu';

-- Verificar se a função existe e está correta
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'mover_leads_nao_respondeu_cron';

-- Testar manualmente para ver o que acontece
SELECT mover_leads_nao_respondeu_cron();

-- Verificar leads que seriam afetados
SELECT 
  nome,
  status,
  nao_respondeu,
  ultima_mensagem_at,
  NOW() AT TIME ZONE 'UTC-3' as agora_local,
  ultima_mensagem_at AT TIME ZONE 'UTC-3' as ultima_msg_local,
  EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC-3') - (ultima_mensagem_at AT TIME ZONE 'UTC-3')))/3600 as horas_local
FROM posts 
WHERE status IN ('respondeu', 'interagiu', 'engajou')
  AND nao_respondeu = FALSE
  AND ultima_mensagem_at IS NOT NULL
ORDER BY ultima_mensagem_at DESC
LIMIT 10;
