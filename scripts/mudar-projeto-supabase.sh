#!/bin/bash

# Script para mudar de projeto Supabase
# De: wtqhpovjntjbjhobqttk (atual)
# Para: wjsbyahzwdupsmopygkg (MCP)

echo "🔄 Mudando projeto Supabase..."

# Novo projeto MCP
NOVO_PROJETO_ID="wjsbyahzwdupsmopygkg"
NOVA_URL="https://wjsbyahzwdupsmopygkg.supabase.co"
NOVA_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqc2J5YWh6d2R1cHNtb3B5Z2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts"

# Atualizar .env.production
sed -i 's/wtqhpovjntjbjhobqttk/'"$NOVO_PROJETO_ID"'/g' .env.production
sed -i 's|https://wtqhpovjntjbjhobqttk.supabase.co|'"$NOVA_URL"'|g' .env.production
sed -i 's|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.*KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts|'"$NOVA_KEY"'|g' .env.production

# Atualizar src/integrations/supabase/client.ts
sed -i 's|https://wtqhpovjntjbjhobqttk.supabase.co|'"$NOVA_URL"'|g' src/integrations/supabase/client.ts
sed -i 's|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.*KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts|'"$NOVA_KEY"'|g' src/integrations/supabase/client.ts

# Atualizar todos os arquivos com URLs hardcoded
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's|https://wtqhpovjntjbjhobqttk.supabase.co|'"$NOVA_URL"'|g'

echo "✅ Projeto atualizado para: $NOVO_PROJETO_ID"
echo "🌐 Nova URL: $NOVA_URL"
echo ""
echo "⚠️  ATENÇÃO: Você precisa:"
echo "1. Copiar as Edge Functions do projeto antigo para o novo"
echo "2. Migrar as tabelas (campanhas, tabela_campanha, posts)"
echo "3. Atualizar as variáveis de ambiente no Supabase Dashboard"
echo "4. Testar todas as funcionalidades"
