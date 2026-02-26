-- Script para adicionar o campo source à tabela agendamento
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar a coluna source
ALTER TABLE agendamento 
ADD COLUMN source TEXT NULL;

-- 2. Adicionar comentário explicativo
COMMENT ON COLUMN agendamento.source IS 'Origem do agendamento: codefy para agendamentos do Codefy, null para manuais';

-- 3. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_agendamento_source ON agendamento(source);

-- 4. Opcional: Adicionar constraint para valores válidos (descomente se necessário)
-- ALTER TABLE agendamento 
-- ADD CONSTRAINT IF NOT EXISTS chk_agendamento_source 
-- CHECK (source IS NULL OR source IN ('codefy', 'manual', 'whatsapp', 'telefone'));

-- 5. Verificar se a coluna foi adicionada corretamente
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'agendamento' AND column_name = 'source';

-- 6. Exemplo de como preencher dados existentes (opcional)
-- UPDATE agendamento SET source = 'manual' WHERE source IS NULL;

-- 7. Contar registros por source após implementação
SELECT 
  COALESCE(source, 'manual') as source,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM agendamento), 2) as percentage
FROM agendamento 
GROUP BY COALESCE(source, 'manual')
ORDER BY count DESC;
