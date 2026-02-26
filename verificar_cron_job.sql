-- =====================================================
-- Verificar Status do Cron Job
-- =====================================================

-- 1. Listar todos os jobs ativos
SELECT 
    jobid,
    jobname,
    schedule,
    command,
    active,
    nodename,
    database
FROM cron.job 
ORDER BY jobid;

-- 2. Verificar especificamente o job do campanha-scheduler
SELECT * FROM cron.job 
WHERE jobname = 'campanha-disparos-um-por-minuto';

-- 3. Verificar últimas execuções (últimas 10)
SELECT 
    jobid,
    status,
    start_time,
    end_time,
    return_message,
    stderr
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'campanha-disparos-um-por-minuto')
ORDER BY start_time DESC 
LIMIT 10;

-- 4. Verificar execuções com erro nas últimas 2 horas
SELECT 
    jobid,
    status,
    start_time,
    return_message,
    stderr
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'campanha-disparos-um-por-minuto')
  AND status = 'failed'
  AND start_time > NOW() - INTERVAL '2 hours'
ORDER BY start_time DESC;

-- 5. Contar execuções por status (última hora)
SELECT 
    status,
    COUNT(*) as total,
    MIN(start_time) as primeira_execucao,
    MAX(start_time) as ultima_execucao
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'campanha-disparos-um-por-minuto')
  AND start_time > NOW() - INTERVAL '1 hour'
GROUP BY status;

-- 6. Verificar se o job está rodando nos últimos minutos
SELECT 
    DATE_TRUNC('minute', start_time) as minuto,
    COUNT(*) as execucoes,
    COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as sucessos,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as falhas
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'campanha-disparos-um-por-minuto')
  AND start_time > NOW() - INTERVAL '30 minutes'
GROUP BY DATE_TRUNC('minute', start_time)
ORDER BY minuto DESC;

-- 7. Verificar leads pendentes (para saber se há trabalho para o job)
SELECT 
    COUNT(*) as leads_pendentes,
    MIN(criado_em) as lead_mais_antigo,
    MAX(criado_em) as lead_mais_recento
FROM tabela_campanha 
WHERE disparo_feito = false;

-- 8. Verificar performance média (últimas 50 execuções)
SELECT 
    AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as duracao_media_segundos,
    MIN(EXTRACT(EPOCH FROM (end_time - start_time))) as duracao_minima,
    MAX(EXTRACT(EPOCH FROM (end_time - start_time))) as duracao_maxima,
    COUNT(*) as total_execucoes
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'campanha-disparos-um-por-minuto')
  AND status = 'succeeded'
  AND start_time > NOW() - INTERVAL '2 hours'
ORDER BY start_time DESC
LIMIT 50;
