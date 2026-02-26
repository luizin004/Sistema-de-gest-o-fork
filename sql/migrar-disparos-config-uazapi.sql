-- Migração da tabela disparos_config para UAZAPI
-- Execute estes SQLs no Supabase SQL Editor

-- 1. Backup das configurações existentes
CREATE TABLE IF NOT EXISTS disparos_config_backup AS 
SELECT * FROM disparos_config;

-- 2. Verificar se existem campos Z-API antes de remover
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'disparos_config' 
AND table_schema = 'public'
AND column_name LIKE 'zapi_%';

-- 3. Remover campos Z-API (se existirem)
-- Descomente as linhas abaixo apenas se os campos existirem
-- ALTER TABLE disparos_config 
-- DROP COLUMN IF EXISTS zapi_instance_id,
-- DROP COLUMN IF EXISTS zapi_token,
-- DROP COLUMN IF EXISTS zapi_client_token;

-- 4. Adicionar campos UAZAPI (se não existirem)
ALTER TABLE disparos_config 
ADD COLUMN IF NOT EXISTS uazapi_token TEXT DEFAULT 'fcd2612d-6b25-4c8f-aace-29df197301ff',
ADD COLUMN IF NOT EXISTS uazapi_url TEXT DEFAULT 'https://oralaligner.uazapi.com/send/text';

-- 5. Atualizar configurações existentes para usar UAZAPI
UPDATE disparos_config 
SET 
  uazapi_token = 'fcd2612d-6b25-4c8f-aace-29df197301ff',
  uazapi_url = 'https://oralaligner.uazapi.com/send/text'
WHERE tipo IN ('aniversario', 'limpeza');

-- 6. Verificar resultado
SELECT tipo, ativo, uazapi_token, uazapi_url,
       zapi_instance_id, zapi_token, zapi_client_token
FROM disparos_config 
ORDER BY tipo;

-- 7. Teste de clientes com data_limpeza
SELECT nome, telefone, data_limpeza,
       CASE 
         WHEN data_limpeza = CURRENT_DATE + INTERVAL '1 day' THEN 'DISPARAR HOJE'
         WHEN data_limpeza = CURRENT_DATE THEN 'DISPARO ATRASADO'
         ELSE 'AGENDADO'
       END as status_disparo
FROM disparos 
WHERE data_limpeza IS NOT NULL 
AND ativo = true 
ORDER BY data_limpeza
LIMIT 10;
