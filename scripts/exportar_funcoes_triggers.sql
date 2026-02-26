-- =====================================================
-- Exportar Código Fonte das Funções de Triggers
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- 1. Exportar função send_webhook_on_agendou_consulta
SELECT 
    'CREATE OR REPLACE FUNCTION send_webhook_on_agendou_consulta()' || CHR(10) ||
    'RETURNS TRIGGER AS $$' || CHR(10) ||
    prosrc || CHR(10) ||
    '$$ LANGUAGE plpgsql;' as codigo_completo
FROM pg_proc 
WHERE proname = 'send_webhook_on_agendou_consulta';

-- 2. Exportar função sync_agendamento_from_posts
SELECT 
    'CREATE OR REPLACE FUNCTION sync_agendamento_from_posts()' || CHR(10) ||
    'RETURNS TRIGGER AS $$' || CHR(10) ||
    prosrc || CHR(10) ||
    '$$ LANGUAGE plpgsql;' as codigo_completo
FROM pg_proc 
WHERE proname = 'sync_agendamento_from_posts';

-- 3. Exportar função sync_posts_from_agendamento
SELECT 
    'CREATE OR REPLACE FUNCTION sync_posts_from_agendamento()' || CHR(10) ||
    'RETURNS TRIGGER AS $$' || CHR(10) ||
    prosrc || CHR(10) ||
    '$$ LANGUAGE plpgsql;' as codigo_completo
FROM pg_proc 
WHERE proname = 'sync_posts_from_agendamento';

-- 4. Exportar função http_request
SELECT 
    'CREATE OR REPLACE FUNCTION http_request()' || CHR(10) ||
    'RETURNS TRIGGER AS $$' || CHR(10) ||
    prosrc || CHR(10) ||
    '$$ LANGUAGE plpgsql;' as codigo_completo
FROM pg_proc 
WHERE proname = 'http_request';

-- 5. Verificar definições completas dos triggers
SELECT 
    'DROP TRIGGER IF EXISTS ' || t.tgname || ' ON ' || c.relname || ';' || CHR(10) ||
    'CREATE TRIGGER ' || t.tgname || CHR(10) ||
    CASE 
        WHEN t.tgtype::char(1) = 'A' THEN 'AFTER'
        WHEN t.tgtype::char(1) = 'B' THEN 'BEFORE'
        ELSE 'OUTRO'
    END || ' ' ||
    CASE 
        WHEN t.tgtype::char(2) = 'I' THEN 'INSERT'
        WHEN t.tgtype::char(2) = 'U' THEN 'UPDATE'
        WHEN t.tgtype::char(2) = 'D' THEN 'DELETE'
        WHEN t.tgtype::char(2) = 'C' THEN 'INSERT OR UPDATE OR DELETE'
        ELSE 'OUTRO'
    END || ' ON ' || c.relname || CHR(10) ||
    'FOR EACH ROW' || CHR(10) ||
    CASE 
        WHEN t.tgqual IS NOT NULL THEN 'WHEN (' || t.tgqual || ')'
        ELSE ''
    END || CHR(10) ||
    'EXECUTE FUNCTION ' || p.proname || '();' as definicao_trigger
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
