-- FORÇAR ATUALIZAÇÃO DA FUNÇÃO COM FUSO CORRETO

-- 1. Dropar função existente
DROP FUNCTION IF EXISTS mover_leads_nao_respondeu_cron();

-- 2. Recriar com fuso horário UTC-3 EXPLÍCITO
CREATE OR REPLACE FUNCTION mover_leads_nao_respondeu_cron()
RETURNS void AS $$
DECLARE
  duas_horas_atras TIMESTAMP;
  leads_moved INTEGER;
BEGIN
  -- DEBUG: Log para verificar o fuso horário
  RAISE LOG 'DEBUG: NOW() = %, NOW() AT TIME ZONE UTC-3 = %', 
           NOW(), NOW() AT TIME ZONE 'UTC-3';
  
  -- Usar horário local (Brasil UTC-3) de forma EXPLÍCITA
  duas_horas_atras := (NOW() AT TIME ZONE 'UTC-3') - INTERVAL '2 hours';
  
  -- DEBUG: Log para ver o limite
  RAISE LOG 'DEBUG: Limite de 2 horas atrás = %', duas_horas_atras;
  
  -- Atualizar APENAS leads que tem ultima_mensagem_at
  UPDATE posts 
  SET 
    nao_respondeu = TRUE,
    updated_at = NOW()
  WHERE status IN ('respondeu', 'interagiu', 'engajou')
    AND nao_respondeu = FALSE
    AND ultima_mensagem_at IS NOT NULL
    AND ultima_mensagem_at < duas_horas_atras;
  
  GET DIAGNOSTICS leads_moved = ROW_COUNT;
  
  -- Log da execução com horário local
  RAISE LOG 'Mover leads não respondidos: % leads movidos em % (fuso UTC-3)', 
           leads_moved, NOW() AT TIME ZONE 'UTC-3';
  
END;
$$ LANGUAGE plpgsql;

-- 3. Testar manualmente
SELECT mover_leads_nao_respondeu_cron();
