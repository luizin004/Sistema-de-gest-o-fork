-- SOLUÇÃO DEFINITIVA: Usar UTC Puro para evitar erros de fuso horário

-- 1. Dropar função atual
DROP FUNCTION IF EXISTS mover_leads_nao_respondeu_cron();

-- 2. Recriar usando UTC padrão (Mais robusto e seguro)
CREATE OR REPLACE FUNCTION mover_leads_nao_respondeu_cron()
RETURNS void AS $$
DECLARE
  limite_tempo TIMESTAMP WITH TIME ZONE;
  leads_moved INTEGER;
BEGIN
  -- Definir limite como 2 horas atrás em UTC (NOW() é sempre UTC no Supabase)
  limite_tempo := NOW() - INTERVAL '2 hours';
  
  RAISE LOG 'DEBUG: Executando mover_leads. Limite UTC: %', limite_tempo;
  
  -- Atualizar leads
  UPDATE posts 
  SET 
    nao_respondeu = TRUE,
    updated_at = NOW()
  WHERE status IN ('respondeu', 'interagiu', 'engajou')
    AND nao_respondeu = FALSE
    AND ultima_mensagem_at IS NOT NULL
    -- Comparação direta em UTC (segura)
    AND ultima_mensagem_at < limite_tempo;
  
  GET DIAGNOSTICS leads_moved = ROW_COUNT;
  
  RAISE LOG 'Mover leads não respondidos: % leads movidos (Critério: inativo desde % UTC)', 
           leads_moved, limite_tempo;
  
END;
$$ LANGUAGE plpgsql;

-- 3. Resetar leads marcados incorretamente (que têm menos de 2 horas)
UPDATE posts 
SET nao_respondeu = FALSE, updated_at = NOW()
WHERE status IN ('respondeu', 'interagiu', 'engajou')
  AND nao_respondeu = TRUE
  AND ultima_mensagem_at IS NOT NULL
  -- Se a última mensagem foi há menos de 2 horas (UTC), reseta
  AND ultima_mensagem_at > (NOW() - INTERVAL '2 hours');

-- 4. Verificar Pedro Arthur (Confirmação)
SELECT 
  nome, 
  status, 
  nao_respondeu,
  ultima_mensagem_at,
  NOW() - ultima_mensagem_at as tempo_ocioso_real
FROM posts 
WHERE nome ILIKE '%Pedro Arthur%';
