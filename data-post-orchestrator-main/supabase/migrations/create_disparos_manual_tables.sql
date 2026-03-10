-- Migration: Create tables for Disparos Manual system
-- Run this in Supabase Dashboard > SQL Editor

-- Table 1: Campaign headers
CREATE TABLE IF NOT EXISTS disparos_manual_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  uazapi_instance_id TEXT NOT NULL,
  message_template TEXT NOT NULL,
  delay_seconds INT DEFAULT 60,
  batch_size INT DEFAULT 0,
  batch_pause_hours NUMERIC DEFAULT 0,
  only_business_hours BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'aguardando',
  total INT DEFAULT 0,
  processed INT DEFAULT 0,
  success INT DEFAULT 0,
  error INT DEFAULT 0,
  batch_sent_count INT DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_dmc_tenant ON disparos_manual_campanhas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dmc_status ON disparos_manual_campanhas(status);

-- Table 2: Individual leads/messages queue
CREATE TABLE IF NOT EXISTS disparos_manual_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES disparos_manual_campanhas(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  telefone TEXT NOT NULL,
  nome TEXT,
  dados_csv JSONB,
  mensagem_final TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dml_campanha_status ON disparos_manual_leads(campanha_id, status);
CREATE INDEX IF NOT EXISTS idx_dml_tenant ON disparos_manual_leads(tenant_id);

-- RLS (system uses anon key with custom auth)
ALTER TABLE disparos_manual_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparos_manual_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for disparos_manual_campanhas" ON disparos_manual_campanhas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for disparos_manual_leads" ON disparos_manual_leads
  FOR ALL USING (true) WITH CHECK (true);
