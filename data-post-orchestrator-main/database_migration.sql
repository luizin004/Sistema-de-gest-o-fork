-- Migration para adicionar campo 'source' na tabela 'agendamento'
-- Este campo indica a origem do agendamento (Codefy, manual, etc.)

-- Adicionar coluna source à tabela agendamento
ALTER TABLE agendamento 
ADD COLUMN source TEXT NULL;

-- Criar índice para melhor performance em consultas filtrando por source
CREATE INDEX idx_agendamento_source ON agendamento(source);

-- Comentários sobre a coluna
COMMENT ON COLUMN agendamento.source IS 'Origem do agendamento: codefy, null para manual, ou outras fontes';

-- Opcional: Adicionar constraint para valores válidos (se necessário)
-- ALTER TABLE agendamento 
-- ADD CONSTRAINT chk_agendamento_source 
-- CHECK (source IS NULL OR source IN ('codefy', 'manual', 'whatsapp', 'telefone'));

-- Exemplos de uso:
-- INSERT INTO agendamento (nome, telefone, source, ...) VALUES ('Paciente', '11999999999', 'codefy', ...);
-- INSERT INTO agendamento (nome, telefone, source, ...) VALUES ('Paciente', '11999999999', NULL, ...);
-- SELECT * FROM agendamento WHERE source = 'codefy';
-- UPDATE agendamento SET source = 'codefy' WHERE id = 'uuid';
