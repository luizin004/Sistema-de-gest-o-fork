#!/bin/bash

# Script para executar Edge Function a cada 10 minutos
# Use com: crontab -e
# Adicione: */10 * * * * /caminho/para/cron-mover-nao-respondeu.sh

SUPABASE_URL="https://wtqhpovjntjbjhobqttk.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY_AQUI"
EDGE_FUNCTION_URL="${SUPABASE_URL}/functions/v1/mover-nao-respondeu"

# Log file
LOG_FILE="/var/log/mover-nao-respondeu.log"

# Executar Edge Function
echo "$(date): Iniciando execução..." >> $LOG_FILE

response=$(curl -s -X POST \
  "$EDGE_FUNCTION_URL" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json")

echo "$(date): Resposta: $response" >> $LOG_FILE

# Extrair informações
moved=$(echo $response | jq -r '.moved // 0')
message=$(echo $response | jq -r '.message // "Sem mensagem"')

echo "$(date): Leads movidos: $moved" >> $LOG_FILE
echo "$(date): Mensagem: $message" >> $LOG_FILE
echo "$(date): Execução concluída" >> $LOG_FILE
echo "----------------------------------------" >> $LOG_FILE
