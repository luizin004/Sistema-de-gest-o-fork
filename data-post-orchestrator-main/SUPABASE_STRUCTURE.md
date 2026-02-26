# 📊 Estrutura do Supabase - OralDents Brumadinho

## 🗃️ Tabelas Principais

### `disparos_config`
- **id**: UUID (primary key)
- **tipo**: text (aniversario, limpeza, clareamento, consulta)
- **mensagem_template**: text
- **horario_disparo**: time
- **dias_antes**: integer
- **ativo**: boolean
- **zapi_instance_id**: text (opcional)
- **zapi_token**: text (opcional)
- **zapi_client_token**: text (opcional)

### `clientes`
- **id**: UUID (primary key)
- **nome**: text
- **telefone**: text
- **email**: text (opcional)
- **data_aniversario**: date
- **ultima_consulta**: date (opcional)
- **proxima_limpeza**: date (opcional)
- **status**: text (ativo, inativo, etc.)

### `disparos_historico`
- **id**: UUID (primary key)
- **cliente_id**: UUID (foreign key)
- **tipo_disparo**: text
- **mensagem_enviada**: text
- **data_envio**: timestamp
- **status**: text (enviado, falhou, pendente)
- **resposta_cliente**: text (opcional)

## ⚡ Edge Functions

### `disparos-scheduler`
- **URL**: `/functions/v1/disparos-scheduler`
- **Método**: POST
- **Função**: Processa disparos automáticos
- **Teste**: `{ "test": true, "tipo": "limpeza" }`

## 🔗 Integrações

### Z-API WhatsApp
- **Instance ID**: Configurável por tipo de disparo
- **Token**: Configurável por tipo de disparo
- **Webhook**: Para respostas dos clientes

## 📈 Métricas e Monitoramento

### Logs de Disparos
- **Data/Hora**: Timestamp de cada envio
- **Status**: Sucesso/Falha
- **Cliente**: Destinatário
- **Tipo**: Aniversário, Limpeza, etc.

### Performance
- **Taxa de entrega**: % de mensagens enviadas
- **Taxa de resposta**: % de respostas recebidas
- **Tempo de processamento**: ms por disparo

## 🚨 Alertas e Notificações

### Erros Comuns
- **Falha na Z-API**: Verificar token/instance
- **Cliente não encontrado**: Validar dados
- **Template inválido**: Verificar variáveis

### Monitoramento
- **Disparos pendentes**: > 1 hora
- **Taxa de falha**: > 10%
- **API offline**: Timeout > 30s

## 🔄 Backup e Recovery

### Backup Automático
- **Frequência**: Diário
- **Retenção**: 30 dias
- **Local**: Supabase Storage

### Recovery
- **Point-in-time**: Até 30 dias
- **Rollback**: Por tabela
- **Validação**: Pós-restauração
