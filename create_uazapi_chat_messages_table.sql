-- ============================================================================
-- Tabela para armazenar mensagens do chat integradas ao UAZAPI
-- ============================================================================

-- Extensão para gerar UUIDs (caso ainda não esteja habilitada)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.uazapi_chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NULL,
    phone_number text NOT NULL,
    direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content text,
    media_url text,
    media_type text,
    status text NOT NULL DEFAULT 'pending', -- pending | sending | sent | delivered | error
    provider_id text,
    message_type text NOT NULL DEFAULT 'text',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_uazapi_chat_messages_lead_id
    ON public.uazapi_chat_messages (lead_id);

CREATE INDEX IF NOT EXISTS idx_uazapi_chat_messages_phone
    ON public.uazapi_chat_messages (phone_number);

CREATE INDEX IF NOT EXISTS idx_uazapi_chat_messages_created_at
    ON public.uazapi_chat_messages (created_at DESC);

-- Trigger para manter updated_at
CREATE OR REPLACE FUNCTION public.handle_uazapi_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_uazapi_chat_messages_updated_at ON public.uazapi_chat_messages;
CREATE TRIGGER trg_uazapi_chat_messages_updated_at
    BEFORE UPDATE ON public.uazapi_chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_uazapi_chat_messages_updated_at();

-- Habilitar Row Level Security (ajuste as políticas conforme necessário)
ALTER TABLE public.uazapi_chat_messages ENABLE ROW LEVEL SECURITY;

-- Política básica de leitura para usuários autenticados (ajuste conforme necessidade)
DROP POLICY IF EXISTS uazapi_chat_messages_select ON public.uazapi_chat_messages;
CREATE POLICY uazapi_chat_messages_select
ON public.uazapi_chat_messages
FOR SELECT
USING (auth.role() = 'authenticated');

-- Política básica de inserção para a Edge Function (executada com service role)
DROP POLICY IF EXISTS uazapi_chat_messages_insert ON public.uazapi_chat_messages;
CREATE POLICY uazapi_chat_messages_insert
ON public.uazapi_chat_messages
FOR INSERT
WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Política básica de atualização para a Edge Function
DROP POLICY IF EXISTS uazapi_chat_messages_update ON public.uazapi_chat_messages;
CREATE POLICY uazapi_chat_messages_update
ON public.uazapi_chat_messages
FOR UPDATE
USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
