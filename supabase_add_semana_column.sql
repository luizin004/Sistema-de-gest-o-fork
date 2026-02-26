-- Adiciona a coluna semana à tabela escala_semanal
-- Define o valor padrão como 1 para registros existentes
ALTER TABLE escala_semanal 
ADD COLUMN semana INTEGER DEFAULT 1;

-- Opcional: Adicionar um índice para melhorar a performance de busca por semana
CREATE INDEX idx_escala_semanal_semana ON escala_semanal(semana);
