-- Migration: Agendamento Fixo - Tabelas e colunas para agendamento automático via bot
-- Executar no Supabase Dashboard > SQL Editor
-- Data: 2026-03-11

BEGIN;

-- ============================================================================
-- 1. Tabela: chatbot_schedule_config (grade semanal por bot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chatbot_schedule_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_config_id UUID NOT NULL REFERENCES chatbot_config(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  weekly_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  lookahead_days INTEGER NOT NULL DEFAULT 14,
  allow_bot_cancel BOOLEAN NOT NULL DEFAULT false,
  slot_buffer_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_schedule_config_bot UNIQUE (chatbot_config_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_config_bot ON chatbot_schedule_config(chatbot_config_id);
CREATE INDEX IF NOT EXISTS idx_schedule_config_tenant ON chatbot_schedule_config(tenant_id);

-- ============================================================================
-- 2. Tabela: chatbot_blocked_periods (períodos indisponíveis por bot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chatbot_blocked_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_config_id UUID NOT NULL REFERENCES chatbot_config(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  blocked_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_blocked_time_range CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_blocked_periods_bot_date ON chatbot_blocked_periods(chatbot_config_id, blocked_date);
CREATE INDEX IF NOT EXISTS idx_blocked_periods_tenant ON chatbot_blocked_periods(tenant_id);

-- ============================================================================
-- 3. Colunas novas em chatbot_conversations (estado do agendamento)
-- ============================================================================
ALTER TABLE chatbot_conversations
  ADD COLUMN IF NOT EXISTS scheduling_state TEXT,
  ADD COLUMN IF NOT EXISTS scheduling_data JSONB;

CREATE INDEX IF NOT EXISTS idx_conversations_scheduling
  ON chatbot_conversations(scheduling_state)
  WHERE scheduling_state IS NOT NULL;

-- ============================================================================
-- 4. Coluna duracao_minutos em tratamentos
-- ============================================================================
ALTER TABLE tratamentos
  ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER DEFAULT 60;

-- ============================================================================
-- 5. Colunas novas em agendamento (source, duração, tratamento)
-- ============================================================================
ALTER TABLE agendamento
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS tratamento TEXT,
  ADD COLUMN IF NOT EXISTS tratamento_id UUID;

-- Índice para busca de slots disponíveis (consulta por tenant + data)
CREATE INDEX IF NOT EXISTS idx_agendamento_tenant_date ON agendamento(tenant_id, data_marcada);

-- Constraint para prevenir double-booking (mesmo tenant, data e horário)
-- Usa um unique index parcial para não bloquear agendamentos cancelados
CREATE UNIQUE INDEX IF NOT EXISTS uq_agendamento_no_double_booking
  ON agendamento(tenant_id, data_marcada, horario)
  WHERE status != 'cancelado';

-- ============================================================================
-- 6. RLS (Row Level Security) para novas tabelas
-- ============================================================================
ALTER TABLE chatbot_schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_blocked_periods ENABLE ROW LEVEL SECURITY;

-- Política para chatbot_schedule_config
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chatbot_schedule_config' AND policyname = 'schedule_config_tenant_access'
  ) THEN
    CREATE POLICY schedule_config_tenant_access ON chatbot_schedule_config
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- Política para chatbot_blocked_periods
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chatbot_blocked_periods' AND policyname = 'blocked_periods_tenant_access'
  ) THEN
    CREATE POLICY blocked_periods_tenant_access ON chatbot_blocked_periods
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- Políticas de acesso para service_role (bypass RLS para edge functions)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chatbot_schedule_config' AND policyname = 'schedule_config_service_role'
  ) THEN
    CREATE POLICY schedule_config_service_role ON chatbot_schedule_config
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chatbot_blocked_periods' AND policyname = 'blocked_periods_service_role'
  ) THEN
    CREATE POLICY blocked_periods_service_role ON chatbot_blocked_periods
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMIT;
