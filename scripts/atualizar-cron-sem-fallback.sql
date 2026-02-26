-- Atualizar função do cron job para usar APENAS ultima_mensagem_at
-- Com correção de fuso horário (UTC-3 para Brasil)

CREATE OR REPLACE FUNCTION mover_leads_nao_respondeu_cron()
RETURNS void AS $$
DECLARE
  duas_horas_atras TIMESTAMP;
  leads_moved INTEGER;
BEGIN
  -- Usar horário local (Brasil UTC-3) em vez de UTC
  duas_horas_atras := (NOW() AT TIME ZONE 'UTC-3') - INTERVAL '2 hours';
  
  -- Atualizar APENAS leads que tem ultima_mensagem_at
  UPDATE posts 
  SET 
    nao_respondeu = TRUE,
    updated_at = NOW()
  WHERE status IN ('respondeu', 'interagiu', 'engajou')
    AND nao_respondeu = FALSE
    AND ultima_mensagem_at IS NOT NULL  -- Apenas os que tem o campo preenchido
    AND ultima_mensagem_at < duas_horas_atras;  -- E estão há mais de 2 horas (local time)
  
  GET DIAGNOSTICS leads_moved = ROW_COUNT;
  
  -- Log da execução com horário local
  RAISE LOG 'Mover leads não respondidos: % leads movidos em % (apenas com ultima_mensagem_at, fuso UTC-3)', 
           leads_moved, NOW() AT TIME ZONE 'UTC-3';
  
END;
$$ LANGUAGE plpgsql;

-- Reagendar o cron job (se necessário)
-- SELECT cron.unschedule('mover-leads-nao-respondeu');
-- SELECT cron.schedule(
--   'mover-leads-nao-respondeu',
--   '*/10 * * * *',
--   'SELECT mover_leads_nao_respondeu_cron();'
-- );
