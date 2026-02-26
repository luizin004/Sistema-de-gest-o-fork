-- ============================================================
-- SCRIPT DE ATUALIZAÇÃO - Adicionar Trigger de Deleção em Cascata
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- Criar função que remove horários quando dentista é desativado
CREATE OR REPLACE FUNCTION delete_escala_on_dentista_inactive()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o dentista foi desativado, remove todos os seus horários
    IF NEW.ativo = FALSE AND OLD.ativo = TRUE THEN
        DELETE FROM escala_semanal WHERE dentista_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger se já existir (para evitar erro)
DROP TRIGGER IF EXISTS trigger_delete_escala_on_dentista_inactive ON dentistas;

-- Criar trigger que executa a função
CREATE TRIGGER trigger_delete_escala_on_dentista_inactive
    AFTER UPDATE ON dentistas
    FOR EACH ROW
    EXECUTE FUNCTION delete_escala_on_dentista_inactive();

-- ============================================================
-- FIM DO SCRIPT DE ATUALIZAÇÃO
-- ============================================================

-- INSTRUÇÕES:
-- 1. Acesse: https://supabase.com/dashboard/project/wtqhpovjntjbjhobqttk/sql/new
-- 2. Cole este script completo
-- 3. Clique em "Run"
-- 4. Pronto! Agora quando excluir um dentista, os horários serão removidos automaticamente
