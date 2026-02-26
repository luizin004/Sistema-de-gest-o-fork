-- Schema para o Sistema de Campanhas WhatsApp
-- Execute este SQL no Supabase SQL Editor

-- Tabela de configurações das campanhas
CREATE TABLE IF NOT EXISTS tabela_campanha (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    mensagem_template TEXT NOT NULL,
    data_inicio DATE,
    data_fim DATE,
    ativo BOOLEAN DEFAULT false,
    uazapi_base_url VARCHAR(500),
    uazapi_instance_token VARCHAR(500),
    uazapi_admin_token VARCHAR(500),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de leads da campanha
CREATE TABLE IF NOT EXISTS campanha_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campanha_id UUID REFERENCES tabela_campanha(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'erro')),
    mensagem_enviada TEXT,
    erro TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_campanha_leads_campanha_id ON campanha_leads(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanha_leads_status ON campanha_leads(status);
CREATE INDEX IF NOT EXISTS idx_campanha_leads_criado_em ON campanha_leads(criado_em);
CREATE INDEX IF NOT EXISTS idx_tabela_campanha_ativo ON tabela_campanha(ativo);

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tabela_campanha_updated_at 
    BEFORE UPDATE ON tabela_campanha 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campanha_leads_updated_at 
    BEFORE UPDATE ON campanha_leads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Política de segurança (se necessário)
-- ALTER TABLE tabela_campanha ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE campanha_leads ENABLE ROW LEVEL SECURITY;

-- Inserir dados de exemplo (opcional)
INSERT INTO tabela_campanha (
    nome, 
    descricao, 
    mensagem_template, 
    data_inicio, 
    data_fim, 
    ativo,
    uazapi_base_url,
    uazapi_instance_token
) VALUES (
    'Campanha de Boas-Vindas',
    'Campanha para novos leads',
    '🎉 Olá {nome}! Seja bem-vindo(a) à OralDents Brumadinho! 🦷✨\n\nTemos uma oferta especial para você: 10% de desconto na primeira consulta!\n\n📞 Agende já: (31) 98567-1234\n\n📍 Rua Principal, 123 - Brumadinho/MG\n\nAguardamos sua visita! 😊',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    false,
    'https://oralaligner.uazapi.com',
    'seu_instance_token_aqui'
) ON CONFLICT DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE tabela_campanha IS 'Configurações das campanhas de WhatsApp';
COMMENT ON TABLE campanha_leads IS 'Leads que receberão mensagens da campanha';
COMMENT ON COLUMN campanha_leads.status IS 'pendente: aguardando envio; enviado: mensagem enviada com sucesso; erro: falha no envio';
COMMENT ON COLUMN tabela_campanha.ativo IS 'Apenas uma campanha pode estar ativa por vez';
