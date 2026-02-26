-- Script de Verificação e Criação de Tabelas
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar se a tabela existe
SELECT 
    table_name, 
    table_type,
    table_schema
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'tabela_campanha'
ORDER BY table_name;

-- 2. Se a tabela não existir, execute os comandos abaixo:

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

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tabela_campanha_ativo ON tabela_campanha(ativo);

-- 4. Inserir dados de teste
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
    true,  -- ATIVAR POR PADRÃO
    'https://oralaligner.uazapi.com',
    'test_token'
) ON CONFLICT DO NOTHING;

-- 5. Verificar se tudo foi criado corretamente
SELECT COUNT(*) as total_campanhas FROM tabela_campanha;

-- 6. Testar consulta que estava dando erro
SELECT * FROM tabela_campanha WHERE ativo = true;
