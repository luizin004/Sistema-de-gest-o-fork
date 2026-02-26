-- Verificar constraints da tabela disparos para corrigir ON CONFLICT
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  tc.table_name
FROM 
  information_schema.table_constraints tc
JOIN 
  information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE 
  tc.table_name = 'disparos'
  AND tc.table_schema = 'public'
ORDER BY 
  tc.constraint_type, tc.constraint_name;

-- Verificar índices únicos
SELECT 
  indexname, 
  indexdef,
  tablename
FROM 
  pg_indexes
WHERE 
  tablename = 'disparos'
  AND schemaname = 'public'
  AND indexdef LIKE '%UNIQUE%';

-- Estrutura completa da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'disparos'
  AND table_schema = 'public'
ORDER BY 
  ordinal_position;
