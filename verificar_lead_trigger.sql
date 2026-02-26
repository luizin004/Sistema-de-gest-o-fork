-- =====================================================
-- Verificar Lead "trigger teste" no Calendário
-- =====================================================

-- 1. Buscar lead "trigger teste" na tabela_campanha
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
WHERE nome ILIKE '%trigger%';

-- 2. Verificar se existe agendamento para este lead
SELECT 
    a.id,
    a.nome,
    a.telefone,
    a.data,
    a.data_marcada,
    a.horario,
    a.dentista,
    a.tratamento,
    a.presenca,
    a.confirmado,
    a.source,
    a.created_at
FROM agendamento a
WHERE a.nome ILIKE '%trigger%'
   OR a.telefone IN (SELECT telefone FROM tabela_campanha WHERE nome ILIKE '%trigger%')
ORDER BY a.created_at DESC;

-- 3. Verificar se há função/processo que cria agendamentos
SELECT 
    proname,
    prosrc
FROM pg_proc 
WHERE proname ILIKE '%agendamento%'
   OR proname ILIKE '%criar%'
   OR proname ILIKE '%agendar%';

-- 4. Verificar se lead tem campo agendado_para preenchido
SELECT 
    id,
    nome,
    telefone,
    agendado_para,
    disparo_feito,
    criado_em,
    CASE 
        WHEN agendado_para IS NOT NULL THEN 'Tem agendamento'
        ELSE 'Sem agendamento'
    END as status_agendamento
FROM tabela_campanha 
WHERE nome ILIKE '%trigger%';

-- 5. Verificar todos os leads recentes com agendamento
SELECT 
    id,
    nome,
    telefone,
    agendado_para,
    disparo_feito,
    criado_em
FROM tabela_campanha 
WHERE agendado_para IS NOT NULL
  AND criado_em > NOW() - INTERVAL '1 day'
ORDER BY criado_em DESC
LIMIT 10;
