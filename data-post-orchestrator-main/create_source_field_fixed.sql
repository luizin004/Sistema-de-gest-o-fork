-- Script corrigido para criar o campo source na tabela agendamento
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
        EXECUTE 'ALTER TABLE agendamento ADD COLUMN source TEXT NULL';
        
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

-- PASSO 5: VERIFICAR COLUNAS OBRIGATÓRIAS ANTES DE TESTAR
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'agendamento' AND is_nullable = 'NO';

-- PASSO 6: Testar inserção COM TODOS OS CAMPOS OBRIGATÓRIOS
-- ATENÇÃO: Precisamos fornecer author_id que é NOT NULL
INSERT INTO agendamento (
  nome, 
  source, 
  author_id,  -- Campo obrigatório
  created_at,
  updated_at
) VALUES (
  'Teste Source Field', 
  'codefy', 
  '00000000-0000-0000-0000-000000000000',  -- UUID válido (substitua por um real)
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- PASSO 7: Verificar inserção
SELECT id, nome, source, author_id, created_at 
FROM agendamento 
WHERE nome = 'Teste Source Field';

-- PASSO 8: Limpar dado de teste
DELETE FROM agendamento WHERE nome = 'Teste Source Field';

-- PASSO 9: Estatísticas do campo source
SELECT 
  source,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM agendamento), 2) as percentage
FROM agendamento 
GROUP BY source
ORDER BY source DESC NULLS LAST;

-- PASSO 10: Mostrar estrutura completa da tabela
\d agendamento
