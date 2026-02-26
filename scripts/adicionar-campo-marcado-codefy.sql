-- Adicionar coluna marcado_codefy na tabela posts
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS marcado_codefy BOOLEAN DEFAULT FALSE;

-- Atualizar tipos se necessário (já está no types.ts)
