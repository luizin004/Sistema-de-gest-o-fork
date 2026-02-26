-- ============================================================
-- SISTEMA DE GESTÃO DE HORÁRIOS - CONSULTÓRIOS ODONTOLÓGICOS
-- Script SQL para Supabase (PostgreSQL)
-- ============================================================

-- ============================================================
-- 1. TABELA: dentistas
-- Armazena informações dos profissionais
-- ============================================================
CREATE TABLE IF NOT EXISTS dentistas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    especialidade TEXT NOT NULL,
    cor_hex TEXT NOT NULL DEFAULT '#8B5CF6',
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_cor_hex CHECK (cor_hex ~ '^#[0-9A-Fa-f]{6}$')
);

-- ============================================================
-- 2. TABELA: consultorios
-- Armazena os 4 consultórios da clínica
-- ============================================================
CREATE TABLE IF NOT EXISTS consultorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    numero INTEGER NOT NULL UNIQUE,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABELA: escala_semanal
-- Gerencia os horários de cada consultório
-- dia_semana: 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
-- horario_inicio: formato TIME (07:00, 08:00, ..., 19:00)
-- ============================================================
CREATE TABLE IF NOT EXISTS escala_semanal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dentista_id UUID NOT NULL REFERENCES dentistas(id) ON DELETE CASCADE,
    consultorio_id UUID NOT NULL REFERENCES consultorios(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 6),
    horario_inicio TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Impede que um consultório tenha dois dentistas no mesmo horário
    CONSTRAINT unique_consultorio_horario UNIQUE (consultorio_id, dia_semana, horario_inicio),
    
    -- Impede que um dentista esteja em dois lugares ao mesmo tempo
    CONSTRAINT unique_dentista_horario UNIQUE (dentista_id, dia_semana, horario_inicio)
);

-- ============================================================
-- 4. ÍNDICES para otimização de consultas
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_escala_dentista ON escala_semanal(dentista_id);
CREATE INDEX IF NOT EXISTS idx_escala_consultorio ON escala_semanal(consultorio_id);
CREATE INDEX IF NOT EXISTS idx_escala_dia_horario ON escala_semanal(dia_semana, horario_inicio);
CREATE INDEX IF NOT EXISTS idx_dentistas_ativo ON dentistas(ativo) WHERE ativo = TRUE;

-- ============================================================
-- 5. FUNÇÃO: Atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_dentistas_updated_at
    BEFORE UPDATE ON dentistas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultorios_updated_at
    BEFORE UPDATE ON consultorios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escala_updated_at
    BEFORE UPDATE ON escala_semanal
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. TRIGGER: Remover horários quando dentista for desativado
-- ============================================================
CREATE OR REPLACE FUNCTION delete_escala_on_dentista_inactive()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o dentista foi desativado, remove todos os seus horários
    IF NEW.ativo = FALSE AND OLD.ativo = TRUE THEN
        DELETE FROM escala_semanal WHERE dentista_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_escala_on_dentista_inactive
    AFTER UPDATE ON dentistas
    FOR EACH ROW
    EXECUTE FUNCTION delete_escala_on_dentista_inactive();

-- ============================================================
-- 7. POLÍTICAS RLS (Row Level Security) - OPCIONAL
-- Descomente se quiser usar autenticação do Supabase
-- ============================================================

-- ALTER TABLE dentistas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE consultorios ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE escala_semanal ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública
-- CREATE POLICY "Permitir leitura pública de dentistas" ON dentistas FOR SELECT USING (true);
-- CREATE POLICY "Permitir leitura pública de consultorios" ON consultorios FOR SELECT USING (true);
-- CREATE POLICY "Permitir leitura pública de escala" ON escala_semanal FOR SELECT USING (true);

-- Permitir escrita apenas para usuários autenticados
-- CREATE POLICY "Permitir insert para autenticados" ON dentistas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Permitir update para autenticados" ON dentistas FOR UPDATE USING (auth.role() = 'authenticated');
-- CREATE POLICY "Permitir delete para autenticados" ON dentistas FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 7. DADOS INICIAIS: 4 Consultórios
-- ============================================================
INSERT INTO consultorios (nome, numero) VALUES
    ('Consultório 1', 1),
    ('Consultório 2', 2),
    ('Consultório 3', 3),
    ('Consultório 4', 4)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- 8. VIEWS ÚTEIS
-- ============================================================

-- View para visualizar escala completa com informações dos dentistas
CREATE OR REPLACE VIEW vw_escala_completa AS
SELECT 
    e.id,
    e.dia_semana,
    CASE e.dia_semana
        WHEN 1 THEN 'Segunda-feira'
        WHEN 2 THEN 'Terça-feira'
        WHEN 3 THEN 'Quarta-feira'
        WHEN 4 THEN 'Quinta-feira'
        WHEN 5 THEN 'Sexta-feira'
        WHEN 6 THEN 'Sábado'
    END AS dia_nome,
    e.horario_inicio,
    c.id AS consultorio_id,
    c.nome AS consultorio_nome,
    c.numero AS consultorio_numero,
    d.id AS dentista_id,
    d.nome AS dentista_nome,
    d.especialidade AS dentista_especialidade,
    d.cor_hex AS dentista_cor,
    e.created_at,
    e.updated_at
FROM escala_semanal e
JOIN consultorios c ON e.consultorio_id = c.id
JOIN dentistas d ON e.dentista_id = d.id
WHERE d.ativo = TRUE AND c.ativo = TRUE
ORDER BY c.numero, e.dia_semana, e.horario_inicio;

-- View para contar horários por dentista
CREATE OR REPLACE VIEW vw_estatisticas_dentistas AS
SELECT 
    d.id,
    d.nome,
    d.especialidade,
    d.cor_hex,
    COUNT(e.id) AS total_horarios,
    COUNT(DISTINCT e.consultorio_id) AS total_consultorios,
    MIN(e.horario_inicio) AS primeiro_horario,
    MAX(e.horario_inicio) AS ultimo_horario
FROM dentistas d
LEFT JOIN escala_semanal e ON d.id = e.dentista_id
WHERE d.ativo = TRUE
GROUP BY d.id, d.nome, d.especialidade, d.cor_hex
ORDER BY d.nome;

-- View para ver disponibilidade por consultório
CREATE OR REPLACE VIEW vw_disponibilidade_consultorios AS
SELECT 
    c.id,
    c.nome,
    c.numero,
    COUNT(e.id) AS horarios_ocupados,
    (6 * 13) AS total_horarios_semana, -- 6 dias * 13 horas
    (6 * 13) - COUNT(e.id) AS horarios_disponiveis,
    ROUND(COUNT(e.id)::NUMERIC / (6 * 13) * 100, 2) AS percentual_ocupacao
FROM consultorios c
LEFT JOIN escala_semanal e ON c.id = e.consultorio_id
WHERE c.ativo = TRUE
GROUP BY c.id, c.nome, c.numero
ORDER BY c.numero;

-- ============================================================
-- 9. COMENTÁRIOS NAS TABELAS
-- ============================================================
COMMENT ON TABLE dentistas IS 'Cadastro de dentistas da clínica';
COMMENT ON COLUMN dentistas.cor_hex IS 'Cor hexadecimal para identificação visual do dentista (ex: #8B5CF6)';
COMMENT ON COLUMN dentistas.especialidade IS 'Especialidade odontológica do profissional';

COMMENT ON TABLE consultorios IS 'Cadastro dos 4 consultórios da clínica';
COMMENT ON COLUMN consultorios.numero IS 'Número do consultório (1, 2, 3 ou 4)';

COMMENT ON TABLE escala_semanal IS 'Escala semanal de horários por consultório';
COMMENT ON COLUMN escala_semanal.dia_semana IS 'Dia da semana: 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado';
COMMENT ON COLUMN escala_semanal.horario_inicio IS 'Horário de início do slot (07:00 até 19:00)';

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================

-- INSTRUÇÕES DE USO:
-- 1. Acesse seu projeto no Supabase (https://supabase.com)
-- 2. Vá em "SQL Editor"
-- 3. Cole este script completo
-- 4. Execute o script
-- 5. Verifique as tabelas criadas em "Table Editor"
-- 6. Copie a URL e as chaves do projeto em "Project Settings > API"
