-- ============================================================
-- TESTE COMPLETO DOS DISPAROS (aniversario, limpeza, clareamento)
-- ============================================================
-- IMPORTANTE: Substitua o telefone abaixo pelo SEU número real
-- para receber as mensagens de teste no WhatsApp.
-- Formato: 55 + DDD + número (ex: 5531993065999)
-- ============================================================

-- ============================================================
-- PASSO 1: Verificar configuração atual (dias_antes = 0 para todos)
-- ============================================================
SELECT tipo, ativo, dias_antes, horario_disparo,
       LEFT(mensagem_template, 60) as mensagem_preview
FROM disparos_config 
WHERE tipo IN ('aniversario', 'limpeza', 'clareamento', 'consulta')
ORDER BY tipo;

-- ============================================================
-- PASSO 2: Criar clientes de teste com data = HOJE + dias_antes
-- Isso garante que o scheduler vai encontrá-los
-- ============================================================

-- Para aniversario (dias_antes = 0, compara mês/dia)
INSERT INTO disparos (nome, telefone, data_nascimento, ativo)
VALUES ('TESTE_ANIVERSARIO', '5531993065999', CURRENT_DATE, true);

-- Para limpeza (dias_antes = 0, compara data exata)
INSERT INTO disparos (nome, telefone, data_limpeza, ativo)
VALUES ('TESTE_LIMPEZA', '5531993065999', CURRENT_DATE, true);

-- Para clareamento (dias_antes = 0, compara data exata)
INSERT INTO disparos (nome, telefone, data_clareamento, ativo)
VALUES ('TESTE_CLAREAMENTO', '5531993065999', CURRENT_DATE, true);

-- ============================================================
-- PASSO 3: Verificar se os clientes de teste foram criados
-- ============================================================
SELECT id, nome, telefone, data_nascimento, data_limpeza, data_clareamento
FROM disparos 
WHERE nome LIKE 'TESTE_%'
ORDER BY nome;

-- ============================================================
-- PASSO 4: Testar cada tipo via curl (execute no terminal)
-- Substitua SEU_TOKEN pelo anon key do projeto
-- ============================================================

-- TESTE ANIVERSARIO:
-- curl -X POST "https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/disparos-scheduler" ^
--   -H "Content-Type: application/json" ^
--   -H "Authorization: Bearer SEU_ANON_KEY" ^
--   -d "{\"tipo\": \"aniversario\"}"

-- TESTE LIMPEZA:
-- curl -X POST "https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/disparos-scheduler" ^
--   -H "Content-Type: application/json" ^
--   -H "Authorization: Bearer SEU_ANON_KEY" ^
--   -d "{\"tipo\": \"limpeza\"}"

-- TESTE CLAREAMENTO:
-- curl -X POST "https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/disparos-scheduler" ^
--   -H "Content-Type: application/json" ^
--   -H "Authorization: Bearer SEU_ANON_KEY" ^
--   -d "{\"tipo\": \"clareamento\"}"

-- ============================================================
-- PASSO 5: Verificar logs após os testes
-- ============================================================
SELECT tipo, telefone, status, 
       LEFT(mensagem, 60) as mensagem_preview,
       data_disparo,
       resposta_zapi
FROM disparos_automaticos_log 
WHERE tipo IN ('aniversario', 'limpeza', 'clareamento')
ORDER BY data_disparo DESC 
LIMIT 10;

-- ============================================================
-- PASSO 6: LIMPAR clientes de teste (EXECUTAR APÓS OS TESTES)
-- ============================================================
-- DELETE FROM disparos WHERE nome LIKE 'TESTE_%';
-- DELETE FROM disparos_automaticos_log WHERE telefone = '5531993065999' AND data_disparo >= CURRENT_DATE;
