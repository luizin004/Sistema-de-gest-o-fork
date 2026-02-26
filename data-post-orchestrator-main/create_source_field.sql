-- Script completo para criar o campo source na tabela agendamento
-- Execute este script no SQL Editor do Supabase Dashboard

-- PASSO 1: Verificar se a tabela agendamento existe
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'agendamento';

-- PASSO 2: Verificar colunas atuais da tabela agendamento
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'agendamento' 
ORDER BY ordinal_position;

-- PASSO 3: Adicionar a coluna source (com verificação)
DO $$
BEGIN
    -- Verificar se a coluna já existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agendamento' AND column_name = 'source'
    ) THEN
        -- Adicionar a coluna
        EXECUTE 'ALTER TABLE agendamento
ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE agendamento
ADD COLUMN IF NOT EXISTS tratamento TEXT;';
        
        -- Adicionar comentário
        EXECUTE 'COMMENT ON COLUMN agendamento.source IS ''Origem do agendamento: codefy para agendamentos do Codefy, null para manuais''';
        
        -- Criar índice
        EXECUTE 'CREATE INDEX idx_agendamento_source ON agendamento(source)';
        
        RAISE NOTICE 'Campo source adicionado com sucesso';
    ELSE
        RAISE NOTICE 'Campo source já existe';
    END IF;
END $$;

-- PASSO 4: Verificar se o campo foi criado
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'agendamento' AND column_name = 'source';

-- PASSO 5: Testar inserção de dados
INSERT INTO agendamento (nome, source, created_at) 
VALUES ('Teste Source Field', 'codefy', NOW())
ON CONFLICT DO NOTHING;

-- PASSO 6: Verificar inserção
SELECT id, nome, source, created_at 
FROM agendamento 
WHERE nome = 'Teste Source Field';

-- PASSO 7: Limpar dado de teste (opcional)
-- DELETE FROM agendamento WHERE nome = 'Teste Source Field';

-- PASSO 8: Estatísticas do campo
SELECT 
  source,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM agendamento), 2) as percentage
FROM agendamento 
GROUP BY source
ORDER BY source DESC NULLS LAST;
