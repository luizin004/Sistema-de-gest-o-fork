-- CORRIGIR CONVERSÃO DE FUSO HORÁRIO NA FUNÇÃO

-- 1. Dropar função atual
DROP FUNCTION IF EXISTS mover_leads_nao_respondeu_cron();

-- 2. Recriar com conversão CORRETA
CREATE OR REPLACE FUNCTION mover_leads_nao_respondeu_cron()
RETURNS void AS $$
DECLARE
  duas_horas_atras TIMESTAMP;
  leads_moved INTEGER;
BEGIN
  -- DEBUG: Verificar fusos
  RAISE LOG 'DEBUG: NOW() = %, NOW() AT TIME ZONE UTC-3 = %', 
           NOW(), NOW() AT TIME ZONE 'UTC-3';
  
  -- Usar horário local (Brasil UTC-3) - CONVERSÃO CORRETA
  duas_horas_atras := (NOW() AT TIME ZONE 'UTC-3') - INTERVAL '2 hours';
  
  RAISE LOG 'DEBUG: Limite de 2 horas atrás = %', duas_horas_atras;
  
  -- Atualizar APENAS leads que tem ultima_mensagem_at
  UPDATE posts 
  SET 
    nao_respondeu = TRUE,
    updated_at = NOW()
  WHERE status IN ('respondeu', 'interagiu', 'engajou')
    AND nao_respondeu = FALSE
    AND ultima_mensagem_at IS NOT NULL
    -- CONVERSÃO CORRETA DO FUSO HORÁRIO
    AND (ultima_mensagem_at::timestamp AT TIME ZONE 'UTC-3') < duas_horas_atras;
  
  GET DIAGNOSTICS leads_moved = ROW_COUNT;
  
  RAISE LOG 'Mover leads não respondidos: % leads movidos em % (fuso UTC-3)', 
           leads_moved, NOW() AT TIME ZONE 'UTC-3';
  
END;
$$ LANGUAGE plpgsql;

-- 3. Resetar leads marcados incorretamente
UPDATE posts 
SET nao_respondeu = FALSE, updated_at = NOW()
WHERE status IN ('respondeu', 'interagiu', 'engajou')
  AND nao_respondeu = TRUE
  -- Usar a mesma conversão correta
  AND (ultima_mensagem_at::timestamp AT TIME ZONE 'UTC-3') > (NOW() AT TIME ZONE 'UTC-3' - INTERVAL '2 hours');

-- 4. Testar conversão correta
SELECT 
  nome,
  ultima_mensagem_at,
  ultima_mensagem_at::timestamp AT TIME ZONE 'UTC-3' as ultima_msg_local,
  NOW() AT TIME ZONE 'UTC-3' as agora_local,
  EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC-3') - (ultima_mensagem_at::timestamp AT TIME ZONE 'UTC-3')))/3600 as horas_local_correto
FROM posts 
WHERE nome = 'Pedro Arthur';
