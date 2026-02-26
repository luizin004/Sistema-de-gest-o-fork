-- ============================================================
-- CORREÇÃO: Permitir agendamentos independentes por semana
-- ============================================================

-- PASSO 1: Adicionar coluna de controle de semana (se não existir)
ALTER TABLE escala_semanal 
ADD COLUMN IF NOT EXISTS semana INTEGER NOT NULL DEFAULT 1;

-- PASSO 2: Remover constraints antigas que bloqueiam semanas diferentes
ALTER TABLE escala_semanal 
DROP CONSTRAINT IF EXISTS unique_consultorio_horario,
DROP CONSTRAINT IF EXISTS unique_dentista_horario;

-- PASSO 3: Criar novas regras que permitem semanas diferentes
-- Regra: Mesmo consultório, mesmo dia/horário só pode ter 1 dentista NA MESMA SEMANA
ALTER TABLE escala_semanal
ADD CONSTRAINT unique_consultorio_semana_horario 
UNIQUE (consultorio_id, dia_semana, horario_inicio, semana);

-- Regra: Mesmo dentista não pode estar em dois lugares NA MESMA SEMANA/dia/horário
ALTER TABLE escala_semanal
ADD CONSTRAINT unique_dentista_semana_horario 
UNIQUE (dentista_id, dia_semana, horario_inicio, semana);

-- PASSO 4: Atualizar view para incluir campo semana
CREATE OR REPLACE VIEW vw_escala_completa AS
SELECT 
    e.id,
    e.dia_semana,
    e.semana,
    CASE e.dia_semana
        WHEN 1 THEN 'Segunda-feira'
        WHEN 2 THEN 'Terça-feira'
        WHEN 3 THEN 'Quarta-feira'
        WHEN 4 THEN 'Quinta-feira'
        WHEN 5 THEN 'Sexta-feira'
        WHEN 6 THEN 'Sábado'
    END as dia_nome,
    e.horario_inicio,
    c.id as consultorio_id,
    c.nome as consultorio_nome,
    c.numero as consultorio_numero,
    d.id as dentista_id,
    d.nome as dentista_nome,
    d.especialidade,
    d.cor_hex,
    d.ativo as dentista_ativo,
    e.created_at,
    e.updated_at
FROM escala_semanal e
JOIN consultorios c ON e.consultorio_id = c.id
JOIN dentistas d ON e.dentista_id = d.id
WHERE d.ativo = true AND c.ativo = true
ORDER BY c.numero, e.semana, e.dia_semana, e.horario_inicio;

-- PASSO 5: Adicionar índice para performance por semana
CREATE INDEX IF NOT EXISTS idx_escala_semana ON escala_semanal(semana);

-- ============================================================
-- RESULTADO ESPERADO:
-- ✅ Semana 1: Consultório 1, Segunda, 08:00 = Dr. João
-- ✅ Semana 2: Consultório 1, Segunda, 08:00 = Dr. Pedro 
-- ❌ Semana 1: Consultório 1, Segunda, 08:00 = Dr. Pedro (bloqueado)
-- ============================================================
