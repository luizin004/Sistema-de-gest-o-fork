-- Debug para verificar agendamentos de hoje
-- Verificar data atual do servidor
SELECT NOW() as servidor_agora, CURRENT_DATE as data_atual;

-- Verificar todos os agendamentos com datas próximas
SELECT 
  id,
  nome,
  data_marcada,
  DATE(data_marcada) as data_somente,
  horario,
  confirmado,
  presenca,
  CASE 
    WHEN DATE(data_marcada) = CURRENT_DATE THEN 'É HOJE'
    WHEN DATE(data_marcada) = CURRENT_DATE + INTERVAL '1 day' THEN 'É AMANHÃ'
    WHEN DATE(data_marcada) = CURRENT_DATE - INTERVAL '1 day' THEN 'É ONTEM'
    ELSE 'OUTRO DIA'
  END as status_dia,
  CASE 
    WHEN confirmado = false AND presenca IS NULL THEN 'Pendente'
    WHEN confirmado = true AND presenca IS NULL THEN 'Confirmado'
    WHEN presenca = 'Não compareceu' OR presenca = 'desistiu' THEN 'Desistiu'
    WHEN presenca = 'compareceu' OR presenca = 'cadência' THEN 'Cadência'
    ELSE 'Outro'
  END as status_kanban
FROM agendamento 
WHERE data_marcada >= CURRENT_DATE - INTERVAL '7 days' 
  AND data_marcada <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY data_marcada;

-- Verificar especificamente agendamentos de hoje
SELECT 
  COUNT(*) as total_hoje,
  COUNT(CASE WHEN confirmado = false AND presenca IS NULL THEN 1 END) as pendentes,
  COUNT(CASE WHEN confirmado = true AND presenca IS NULL THEN 1 END) as confirmados,
  COUNT(CASE WHEN presenca = 'Não compareceu' OR presenca = 'desistiu' THEN 1 END) as desistiram,
  COUNT(CASE WHEN presenca = 'compareceu' OR presenca = 'cadência' THEN 1 END) as cadencia
FROM agendamento 
WHERE DATE(data_marcada) = CURRENT_DATE;

-- Verificar se há algum problema com fuso horário
SELECT 
  nome,
  data_marcada,
  EXTRACT(TIMEZONE FROM data_marcada) as timezone_offset,
  data_marcada AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as data_sp,
  DATE(data_marcada AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') as data_sp_somente
FROM agendamento 
WHERE data_marcada IS NOT NULL
ORDER BY data_marcada
LIMIT 10;
