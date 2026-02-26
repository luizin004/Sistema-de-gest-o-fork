-- SQL de Conferência Pós-Migração de Clareamento para UAZAPI
-- Execute após o deploy da nova versão do disparos-scheduler

-- 1. Verificar clientes com data_clareamento
SELECT nome, telefone, data_clareamento,
       CASE 
         WHEN data_clareamento = CURRENT_DATE + INTERVAL '1 day' THEN 'DISPARAR HOJE'
         WHEN data_clareamento = CURRENT_DATE THEN 'DISPARO ATRASADO'
         ELSE 'AGENDADO'
       END as status_disparo
FROM disparos 
WHERE data_clareamento IS NOT NULL 
AND ativo = true 
ORDER BY data_clareamento;

-- 2. Verificar configuração de clareamento
SELECT * FROM disparos_config 
WHERE tipo = 'clareamento' 
AND ativo = true;

-- 3. Testar manualmente a função
-- Execute este curl ou use o frontend:
-- curl -X POST https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/disparos-scheduler \
--   -H "Authorization: Bearer SEU_TOKEN" \
--   -H "Content-Type: application/json" \
--   -d '{"test": true, "tipo": "clareamento"}'

-- 4. Verificar logs recentes de disparo
SELECT * FROM disparos_automaticos_log 
WHERE tipo = 'clareamento'
ORDER BY data_execucao DESC 
LIMIT 5;

-- 5. Contar disparos por provider (pós-migração)
SELECT 
  CASE 
    WHEN data_execucao >= CURRENT_DATE THEN 'HOJE'
    WHEN data_execucao >= CURRENT_DATE - INTERVAL '7 days' THEN 'ÚLTIMA SEMANA'
    ELSE 'ANTIGO'
  END as periodo,
  tipo, 
  COUNT(*) as total_execucoes,
  SUM(mensagens_enviadas) as total_enviadas,
  SUM(erros) as total_erros,
  AVG(CASE WHEN mensagens_enviadas > 0 THEN 1.0 ELSE 0.0 END) * 100 as taxa_sucesso_percent
FROM disparos_automaticos_log 
WHERE tipo IN ('aniversario', 'limpeza', 'clareamento', 'confirmacao')
GROUP BY periodo, tipo
ORDER BY periodo DESC, tipo;

-- 6. Verificar status atual de todos os tipos
SELECT 
  dc.tipo,
  dc.ativo,
  dc.uazapi_token IS NOT NULL as tem_uazapi,
  dc.zapi_instance_id IS NOT NULL as tem_zapi,
  COUNT(d.id) as clientes_ativos,
  STRING_AGG(DISTINCT CASE 
    WHEN d.data_nascimento IS NOT NULL THEN 'nascimento'
    WHEN d.data_limpeza IS NOT NULL THEN 'limpeza'
    WHEN d.data_clareamento IS NOT NULL THEN 'clareamento'
    WHEN d.data_consulta IS NOT NULL THEN 'confirmacao'
  END, ', ') as tipos_com_clientes
FROM disparos_config dc
LEFT JOIN disparos d ON (
  (dc.tipo = 'aniversario' AND d.data_nascimento IS NOT NULL) OR
  (dc.tipo = 'limpeza' AND d.data_limpeza IS NOT NULL) OR
  (dc.tipo = 'clareamento' AND d.data_clareamento IS NOT NULL) OR
  (dc.tipo = 'confirmacao' AND d.data_consulta IS NOT NULL)
) AND d.ativo = true
WHERE dc.tipo IN ('aniversario', 'limpeza', 'clareamento', 'confirmacao')
GROUP BY dc.tipo, dc.ativo, dc.uazapi_token, dc.zapi_instance_id
ORDER BY dc.tipo;

-- 7. Criar cliente de teste para clareamento (se necessário)
INSERT INTO disparos (nome, telefone, data_clareamento, ativo, created_at)
VALUES (
  'CLIENTE TESTE CLAREAMENTO', 
  '5531999997777', 
  CURRENT_DATE + INTERVAL '1 day', 
  true, 
  NOW()
)
ON CONFLICT DO NOTHING;

-- 8. Limpar cliente de teste (após testes)
-- DELETE FROM disparos 
-- WHERE nome = 'CLIENTE TESTE CLAREAMENTO' 
-- AND telefone = '5531999997777';
