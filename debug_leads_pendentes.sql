-- =====================================================
-- Debug: Verificar Leads Pendentes
-- =====================================================

-- 1. Total de leads pendentes (sem filtros)
SELECT 
    COUNT(*) as total_pendentes,
    COUNT(*) FILTER (WHERE extras->>'pulado_disparo' = 'true') as pulados,
    COUNT(*) FILTER (WHERE extras->>'pulado_disparo' IS NULL OR extras->>'pulado_disparo' != 'true') as nao_pulados
FROM tabela_campanha 
WHERE disparo_feito = false;

-- 2. Verificar leads que seriam selecionados pelo scheduler
SELECT 
    id,
    nome,
    telefone,
    disparo_feito,
    extras->>'pulado_disparo' as pulado_disparo,
    extras->>'disparo_falhou' as disparo_falhou,
    criado_em
FROM tabela_campanha 
WHERE disparo_feito = false
  AND (extras->>'pulado_disparo' IS NULL OR extras->>'pulado_disparo' != 'true')
ORDER BY criado_em ASC
LIMIT 5;

-- 3. Verificar leads que foram pulados
SELECT 
    id,
    nome,
    telefone,
    disparo_feito,
    extras->>'pulado_disparo' as pulado_disparo,
    extras->>'disparo_falhou' as disparo_falhou,
    extras->>'ultimo_erro' as ultimo_erro,
    criado_em
FROM tabela_campanha 
WHERE extras->>'pulado_disparo' = 'true'
ORDER BY criado_em DESC
LIMIT 5;

-- 4. Verificar estrutura do campo extras
SELECT 
    id,
    nome,
    disparo_feito,
    CASE 
        WHEN extras IS NULL THEN 'NULL'
        WHEN jsonb_typeof(extras) = 'object' THEN 'OBJECT'
        ELSE 'OTHER'
    END as extras_type,
    extras
FROM tabela_campanha 
WHERE disparo_feito = false
ORDER BY criado_em ASC
LIMIT 3;
