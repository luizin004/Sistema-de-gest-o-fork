-- =====================================================
-- Função de Extração de Telefone Base (Versão Definitiva)
-- =====================================================

CREATE OR REPLACE FUNCTION extrair_telefone_base(telefone TEXT)
RETURNS TEXT AS $$
DECLARE
    numero_limpo TEXT;
BEGIN
    -- 1. Limpar caracteres não numéricos
    numero_limpo := regexp_replace(telefone, '[^0-9]', '', 'g');
    
    -- 2. Remover DDI 55 se houver (considerando que o número teria 12 ou 13 dígitos)
    IF LENGTH(numero_limpo) >= 12 AND LEFT(numero_limpo, 2) = '55' THEN
        numero_limpo := SUBSTR(numero_limpo, 3);
    END IF;
    
    -- 3. Validar se tem o tamanho mínimo de um número brasileiro com DDD (10 ou 11 dígitos)
    -- Se tiver menos que 10, não conseguimos identificar o DDD com segurança
    IF LENGTH(numero_limpo) < 10 THEN
        RETURN NULL;
    END IF;

    -- 4. A MÁGICA: Pegar os 2 primeiros (DDD) e os 8 últimos (Número base)
    -- Isso ignora o 9º dígito automaticamente, não importa se ele existe ou não
    RETURN LEFT(numero_limpo, 2) || RIGHT(numero_limpo, 8);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- Trigger de Campanha com Extração (Apenas Leitura)
-- =====================================================

CREATE OR REPLACE FUNCTION verificar_e_associar_campanha()
RETURNS TRIGGER AS $$
DECLARE
    campanha_encontrada RECORD;
    telefone_base_post TEXT;
BEGIN
    -- 1. Se já tem campanha associada, não faz nada
    IF NEW.campanha_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- 2. Se não tem telefone, não faz nada
    IF NEW.telefone IS NULL OR NEW.telefone = '' THEN
        RETURN NEW;
    END IF;
    
    -- 3. Extrair telefone base do post (APENAS PARA COMPARAÇÃO)
    telefone_base_post := extrair_telefone_base(NEW.telefone);
    
    -- 4. Se não conseguiu extrair, não faz nada
    IF telefone_base_post IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- 5. Buscar na tabela_campanha usando extração (APENAS NO WHERE)
    SELECT id, "ID_campanha", nome
    INTO campanha_encontrada
    FROM tabela_campanha 
    WHERE extrair_telefone_base(telefone) = telefone_base_post
    LIMIT 1;
    
    -- 6. Se encontrou, preenche os campos (MAS NÃO MODIFICA O TELEFONE)
    IF campanha_encontrada.id IS NOT NULL THEN
        NEW.campanha_id := campanha_encontrada.id;
        
        -- Mapeamento de nomes
        CASE campanha_encontrada."ID_campanha"
            WHEN 'boas_vindas' THEN NEW.campanha_nome := 'Boas-Vindas';
            WHEN 'clareamento' THEN NEW.campanha_nome := 'Clareamento';
            WHEN 'limpeza'     THEN NEW.campanha_nome := 'Limpeza';
            WHEN 'avaliacao'   THEN NEW.campanha_nome := 'Avaliação';
            WHEN 'ortodontia'  THEN NEW.campanha_nome := 'Ortodontia';
            WHEN 'implante'    THEN NEW.campanha_nome := 'Implante';
            WHEN 'promo'       THEN NEW.campanha_nome := 'Promoção';
            WHEN 'newsletter'  THEN NEW.campanha_nome := 'Newsletter';
            ELSE 
                NEW.campanha_nome := COALESCE(campanha_encontrada."ID_campanha", campanha_encontrada.nome, 'Campanha');
        END CASE;
    END IF;
    
    -- IMPORTANTE: NÃO MODIFICA NEW.telefone - mantém original
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Recriar os Triggers
-- =====================================================

-- Remover triggers antigos se existirem
DROP TRIGGER IF EXISTS trigger_verificar_campanha_insert ON posts;
DROP TRIGGER IF EXISTS trigger_verificar_campanha_update ON posts;

-- Criar triggers novos
CREATE TRIGGER trigger_verificar_campanha_insert
    BEFORE INSERT ON posts
    FOR EACH ROW
    EXECUTE FUNCTION verificar_e_associar_campanha();

CREATE TRIGGER trigger_verificar_campanha_update
    BEFORE UPDATE OF telefone ON posts
    FOR EACH ROW
    WHEN (OLD.telefone IS DISTINCT FROM NEW.telefone)
    EXECUTE FUNCTION verificar_e_associar_campanha();

-- =====================================================
-- Índices para Performance (Opcional)
-- =====================================================

-- Criar índice para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_tabela_campanha_telefone_base 
ON tabela_campanha ((extrair_telefone_base(telefone)));

CREATE INDEX IF NOT EXISTS idx_posts_telefone_base 
ON posts ((extrair_telefone_base(telefone)));

-- =====================================================
-- Teste da Função
-- =====================================================

-- Testes para verificar funcionamento
SELECT 
    telefone_original,
    extrair_telefone_base(telefone_original) as telefone_base
FROM (
    VALUES 
    ('(31) 98765-4321'),
    ('(31) 8765-4321'),
    ('31987654321'),
    ('3187654321'),
    ('+55 31 98765-4321'),
    ('(11) 91234-5678'),
    ('(11) 1234-5678'),
    ('invalido'),
    ('123')
) AS testes(telefone_original);
