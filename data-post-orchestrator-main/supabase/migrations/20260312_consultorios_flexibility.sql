-- Migration: Consultórios Flexibility
-- Adds configurable time slots per consultório and bloqueios table

-- New columns on consultorios
ALTER TABLE consultorios
  ADD COLUMN IF NOT EXISTS horario_abertura TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS horario_fechamento TEXT DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS intervalo_minutos INTEGER DEFAULT 60;

-- Bloqueios table (lunch breaks, pauses)
CREATE TABLE IF NOT EXISTS consultorio_bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultorio_id UUID NOT NULL REFERENCES consultorios(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT NOT NULL,
  motivo TEXT DEFAULT 'Intervalo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (horario_inicio < horario_fim)
);

-- RLS for consultorio_bloqueios
ALTER TABLE consultorio_bloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for consultorio_bloqueios"
  ON consultorio_bloqueios
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_consultorio_bloqueios_consultorio
  ON consultorio_bloqueios(consultorio_id, dia_semana);
