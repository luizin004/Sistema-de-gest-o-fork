-- =====================================================
-- Debug: Verificar lead "Teste Trigger" com status nao_respondeu
-- =====================================================

-- 1. Buscar lead "Teste Trigger"
SELECT 
    id,
    nome,
    status,
    created_at,
    updated_at,
    telefone
FROM posts 
WHERE nome ILIKE '%Teste Trigger%'
   OR nome ILIKE '%teste trigger%'
   OR nome ILIKE '%Teste%trigger%';

-- 2. Buscar todos os leads com status nao_respondeu
SELECT 
    id,
    nome,
    status,
    created_at,
    updated_at,
    telefone
FROM posts 
WHERE status ILIKE '%nao_respondeu%'
   OR status = 'nao_respondeu'
ORDER BY created_at DESC;

-- 3. Verificar exatamente como está o status
SELECT 
    id,
    nome,
    status,
    LENGTH(status) as status_length,
    ASCII(status) as ascii_first_char
FROM posts 
WHERE nome ILIKE '%Teste%';

-- 4. Verificar se há espaços ou caracteres especiais no status
SELECT 
    id,
    nome,
    status,
    '|' || status || '|' as status_with_pipes,
    TRIM(status) as trimmed_status
FROM posts 
WHERE nome ILIKE '%Teste%';

-- 5. Testar a condição exata do KanbanBoardAcao
SELECT 
    id,
    nome,
    status,
    CASE 
        WHEN LOWER(status) LIKE '%nao_respondeu%' THEN 'MATCH_NAO_RESPONDEU'
        ELSE 'NO_MATCH'
    END as kanban_match,
    created_at
FROM posts 
WHERE nome ILIKE '%Teste%';
