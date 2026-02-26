-- =====================================================
-- Debug: Verificar Agendamento do Lead Teste
-- =====================================================

-- 1. Verificar se o lead "teste trigger" existe na tabela de campanha
SELECT 
    id,
    nome,
    telefone,
    disparo_feito,
    ID_campanha,
    agendado_para,
    criado_em,
    extras
FROM tabela_campanha 
WHERE nome ILIKE '%teste trigger%'
   OR nome ILIKE '%teste%';

-- 2. Verificar se existe agendamento na tabela agendamento
SELECT 
    id,
    nome,
    telefone,
    data,
    data_marcada,
    horario,
    dentista,
    tratamento,
    presenca,
    confirmado,
    source,
    created_at
FROM agendamento 
WHERE nome ILIKE '%teste trigger%'
   OR nome ILIKE '%teste%'
   OR telefone LIKE '%teste%'
ORDER BY created_at DESC;

-- 3. Verificar se há algum trigger ou regra criando agendamentos
SELECT 
    schemaname,
    tablename,
    triggername,
    tgtype,
    tgfoid::regproc as function_name,
    tgenabled as enabled
FROM pg_trigger 
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE tgrelid = 'tabela_campanha'::regclass
   OR tgrelid = 'agendamento'::regclass;

-- 4. Verificar se há função que cria agendamentos automaticamente
SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc 
JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
WHERE proname ILIKE '%agendamento%'
   OR proname ILIKE '%trigger%'
   OR prosrc ILIKE '%agendamento%';

-- 5. Verificar leads com agendado_para preenchido
SELECT 
    id,
    nome,
    telefone,
    agendado_para,
    disparo_feito,
    criado_em
FROM tabela_campanha 
WHERE agendado_para IS NOT NULL
ORDER BY criado_em DESC
LIMIT 10;

-- 6. Verificar schema da tabela agendamento
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'agendamento'
  AND table_schema = 'public'
ORDER BY ordinal_position;
