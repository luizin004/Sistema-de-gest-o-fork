-- Atualização do disparos_config para migração de clareamento para UAZAPI
-- Execute estes SQLs no Supabase SQL Editor

-- 1. Verificar configuração atual de clareamento
SELECT * FROM disparos_config 
WHERE tipo = 'clareamento' 
ORDER BY created_at DESC;

-- 2. Backup da configuração atual (se existir)
CREATE TABLE IF NOT EXISTS disparos_config_clareamento_backup AS 
SELECT * FROM disparos_config 
WHERE tipo = 'clareamento';

-- 3. Adicionar campos UAZAPI (se não existirem)
ALTER TABLE disparos_config 
ADD COLUMN IF NOT EXISTS uazapi_token TEXT DEFAULT 'fcd2612d-6b25-4c8f-aace-29df197301ff',
ADD COLUMN IF NOT EXISTS uazapi_url TEXT DEFAULT 'https://oralaligner.uazapi.com/send/text';

-- 4. Atualizar configuração de clareamento para UAZAPI
UPDATE disparos_config 
SET 
  uazapi_token = 'fcd2612d-6b25-4c8f-aace-29df197301ff',
  uazapi_url = 'https://oralaligner.uazapi.com/send/text'
WHERE tipo = 'clareamento';

-- 5. Criar configuração padrão se não existir
INSERT INTO disparos_config (
  tipo, 
  mensagem_template, 
  horario_disparo, 
  dias_antes, 
  ativo,
  uazapi_token,
  uazapi_url
) 
SELECT 
  'clareamento',
  '✨ Olá {nome}! Seu tratamento de clareamento dental está agendado para {data_clareamento}. Lembre-se de evitar alimentos pigmentados. 🌟 OralDents Brumadinho',
  '09:00',
  1,
  true,
  'fcd2612d-6b25-4c8f-aace-29df197301ff',
  'https://oralaligner.uazapi.com/send/text'
WHERE NOT EXISTS (
  SELECT 1 FROM disparos_config WHERE tipo = 'clareamento'
);

-- 6. Verificar resultado final
SELECT 
  tipo, 
  ativo, 
  mensagem_template,
  horario_disparo,
  dias_antes,
  uazapi_token,
  uazapi_url,
  zapi_instance_id,
  zapi_token,
  zapi_client_token
FROM disparos_config 
WHERE tipo IN ('aniversario', 'limpeza', 'clareamento', 'consulta')
ORDER BY tipo;
