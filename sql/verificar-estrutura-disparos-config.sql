-- Verificar estrutura atual da tabela disparos_config
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'disparos_config' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar configurações existentes
SELECT * FROM disparos_config ORDER BY tipo;

-- Verificar clientes com data_limpeza
SELECT nome, telefone, data_limpeza, ativo 
FROM disparos 
WHERE data_limpeza IS NOT NULL 
AND ativo = true 
LIMIT 5;

-- Contar clientes por tipo
SELECT 
  'data_nascimento' as tipo,
  COUNT(*) as total,
  COUNT(CASE WHEN ativo = true THEN 1 END) as ativos
FROM disparos 
WHERE data_nascimento IS NOT NULL
UNION ALL
SELECT 
  'data_limpeza' as tipo,
  COUNT(*) as total,
  COUNT(CASE WHEN ativo = true THEN 1 END) as ativos
FROM disparos 
WHERE data_limpeza IS NOT NULL
UNION ALL
SELECT 
  'data_clareamento' as tipo,
  COUNT(*) as total,
  COUNT(CASE WHEN ativo = true THEN 1 END) as ativos
FROM disparos 
WHERE data_clareamento IS NOT NULL
UNION ALL
SELECT 
  'data_consulta' as tipo,
  COUNT(*) as total,
  COUNT(CASE WHEN ativo = true THEN 1 END) as ativos
FROM disparos 
WHERE data_consulta IS NOT NULL
ORDER BY tipo;
