-- SQLs para testar a migração do sistema de limpeza para UAZAPI
-- Execute após o deploy da nova versão do disparos-scheduler

-- 1. Verificar se há clientes para disparar hoje
SELECT nome, telefone, data_limpeza,
       CASE 
         WHEN data_limpeza = CURRENT_DATE + INTERVAL '1 day' THEN 'DISPARAR HOJE'
         WHEN data_limpeza = CURRENT_DATE THEN 'DISPARO ATRASADO'
         ELSE 'AGENDADO'
       END as status_disparo
FROM disparos 
WHERE data_limpeza IS NOT NULL 
AND ativo = true 
AND data_limpeza <= CURRENT_DATE + INTERVAL '1 day'
ORDER BY data_limpeza;

-- 2. Teste manual via SQL (simulação)
-- Crie um cliente de teste se necessário
INSERT INTO disparos (nome, telefone, data_limpeza, ativo, created_at)
VALUES (
  'CLIENTE TESTE LIMPEZA', 
  '5531999998888', 
  CURRENT_DATE + INTERVAL '1 day', 
  true, 
  NOW()
);

-- 3. Verificar configuração de limpeza
SELECT * FROM disparos_config 
WHERE tipo = 'limpeza' 
AND ativo = true;

-- 4. Verificar logs recentes de disparo
SELECT * FROM disparos_automaticos_log 
WHERE tipo = 'limpeza'
ORDER BY data_execucao DESC 
LIMIT 5;

-- 5. Contar quantos disparos foram feitos por provider
SELECT 
  CASE 
    WHEN data_execucao >= '2025-02-17' THEN 'PÓS MIGRAÇÃO'
    ELSE 'PRÉ MIGRAÇÃO'
  END as periodo,
  tipo,
  COUNT(*) as total_execucoes,
  SUM(mensagens_enviadas) as total_enviadas,
  SUM(erros) as total_erros
FROM disparos_automaticos_log 
WHERE tipo = 'limpeza'
GROUP BY periodo, tipo
ORDER BY periodo DESC;

-- 6. Limpar cliente de teste (se criado)
DELETE FROM disparos 
WHERE nome = 'CLIENTE TESTE LIMPEZA' 
AND telefone = '5531999998888';
