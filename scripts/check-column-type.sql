-- Verificar tipo da coluna ultima_mensagem_at
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'posts' AND column_name = 'ultima_mensagem_at';
