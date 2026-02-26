-- =====================================================
-- Verificar Funções dos Triggers de Agendamento
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- 1. Verificar função send_webhook_on_agendou_consulta
SELECT 
    proname as nome_funcao,
    prosrc as codigo_fonte,
    prolang as linguagem,
    pronargs as numero_argumentos,
    proargtypes as tipos_argumentos
FROM pg_proc 
WHERE proname = 'send_webhook_on_agendou_consulta';

-- 2. Verificar função sync_agendamento_from_posts
SELECT 
    pronome as nome_funcao,
    prosrc as codigo_fonte,
    prolang as linguagem,
    pronargs as numero_argumentos,
    proargtypes as tipos_argumentos
FROM pg_proc 
WHERE proname = 'sync_agendamento_from_posts';

-- 3. Verificar função sync_posts_from_agendamento
SELECT 
    pronome as nome_funcao,
    prosrc as codigo_fonte,
    prolang as linguagem,
    pronargs as numero_argumentos,
    proargtypes as tipos_argumentos
FROM pg_proc 
WHERE proname = 'sync_posts_from_agendamento';

-- 4. Verificar função http_request
SELECT 
    pronome as nome_funcao,
    prosrc as codigo_fonte,
    prolang as linguagem,
    pronargs as numero_argumentos,
    proargtypes as tipos_argumentos
FROM pg_proc 
WHERE proname = 'http_request';

-- 5. Listar todas as funções relacionadas a agendamento
SELECT 
    proname as nome_funcao,
    prosrc as codigo_fonte
FROM pg_proc 
WHERE proname ILIKE '%agendamento%'
   OR proname ILIKE '%webhook%'
   OR proname ILIKE '%sync%'
ORDER BY proname;

-- 6. Verificar triggers específicos
SELECT 
    t.tgname as nome_trigger,
    c.relname as tabela,
    p.proname as funcao_chamada,
    CASE 
        WHEN t.tgtype::char(1) = 'A' THEN 'AFTER'
        WHEN t.tgtype::char(1) = 'B' THEN 'BEFORE'
        ELSE 'OUTRO'
    END as momento,
    CASE 
        WHEN t.tgtype::char(2) = 'I' THEN 'INSERT'
        WHEN t.tgtype::char(2) = 'U' THEN 'UPDATE'
        WHEN t.tgtype::char(2) = 'D' THEN 'DELETE'
        WHEN t.tgtype::char(2) = 'C' THEN 'INSERT/UPDATE/DELETE'
        ELSE 'OUTRO'
    END as evento,
    t.tgenabled as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('posts', 'agendamento')
  AND NOT t.tgisinternal
  AND (
       p.proname ILIKE '%agendamento%'
    OR p.proname ILIKE '%webhook%'
    OR p.proname ILIKE '%sync%'
    OR p.proname ILIKE '%http%'
  )
ORDER BY c.relname, t.tgname;
