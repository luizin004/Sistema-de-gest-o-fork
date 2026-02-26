# 🚀 Sistema de Campanhas WhatsApp Automático

Sistema completo para gerenciar campanhas de WhatsApp com envio automático de mensagens para leads adicionados ao Supabase.

## 📋 Funcionalidades

- ✅ **Campanha Ativa Única**: Apenas uma campanha pode estar ativa por vez
- ✅ **Envio Automático**: Processamento automático de leads pendentes
- ✅ **Personalização**: Substituição de variáveis nas mensagens
- ✅ **Agendamento**: Execução em intervalos regulares
- ✅ **Controle de Status**: Acompanhamento do status de cada envio
- ✅ **Tratamento de Erros**: Registro e tratamento de falhas
- ✅ **Rate Limiting**: Delay entre envios para não sobrecarregar a API

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Edge Function   │    │   Python        │
│   (React)       │───▶│   (Supabase)     │───▶│   Processor     │
│                 │    │                  │    │                 │
│ • Gerenciar     │    │ • Receber leads  │    │ • Enviar msgs   │
│ • Configurar    │    │ • Validar dados  │    │ • UAZAPI        │
│ • Visualizar    │    │ • Disparar envio  │    │ • Agendar       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Supabase DB   │
                       │                 │
                       │ • campanhas_config │
                       │ • campanha_leads   │
                       └─────────────────┘
```

## 🚀 Instalação e Configuração

### 1. Configurar Supabase

Execute o SQL do arquivo `campanha_schema.sql` no Supabase SQL Editor:

```sql
-- Isso criará as tabelas necessárias
campanhas_config
campanha_leads
```

### 2. Configurar Edge Function

Copie o arquivo `supabase/functions/campanha/index.ts` para o seu projeto Supabase:

```bash
# Estrutura de pastas
supabase/
└── functions/
    └── campanha/
        └── index.ts
```

### 3. Configurar Python

Instale as dependências:

```bash
pip install -r requirements_campanha.txt
```

### 4. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo:

```bash
cp env_campanha_example.txt .env
```

Edite o arquivo `.env` com suas credenciais:

```env
# Supabase
SUPABASE_URL=https://wtqhpovjntjbjhobqttk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role

# UAZAPI
UAZAPI_BASE_URL=https://oralaligner.uazapi.com
UAZAPI_INSTANCE_TOKEN=seu_instance_token
UAZAPI_ADMIN_TOKEN=seu_admin_token

# Configurações
DELAY_ENTRE_ENVIOS=5
MAX_TENTATIVAS=3
TIMEOUT_REQUEST=30
```

## 🔄 Como Funciona

### Fluxo Automático:

1. **Lead Adicionado**: Frontend adiciona lead via Edge Function
2. **Status Pendente**: Lead fica com status 'pendente'
3. **Processador Executa**: Python busca leads pendentes
4. **Envio UAZAPI**: Mensagem enviada via WhatsApp
5. **Status Atualizado**: Lead marcado como 'enviado' ou 'erro'

### Agendamento:

O processador é executado automaticamente:
- A cada 5 minutos
- A cada hora  
- Diário às 9h, 14h e 18h

## 📱 Uso via API

### Adicionar Lead à Campanha

```javascript
// POST https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/campanha
const response = await fetch('https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/campanha', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sua_chave_anon',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    nome: 'João Silva',
    telefone: '31985671234'
  })
});
```

### Listar Leads da Campanha

```javascript
// GET https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/campanha
const response = await fetch('https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/campanha', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer sua_chave_anon'
  }
});
```

## 🖥️ Executar o Processador

### Execução Manual

```bash
# Processar leads pendentes uma vez
python campanha_processor.py
```

### Execução Agendada

```bash
# Iniciar agendador contínuo
python campanha_scheduler.py
```

### Execução como Serviço (Linux)

```bash
# Criar serviço systemd
sudo nano /etc/systemd/system/campanha-processor.service
```

```ini
[Unit]
Description=Campanha WhatsApp Processor
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/DisparosWhatsapp
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/python3 campanha_scheduler.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar e iniciar serviço
sudo systemctl enable campanha-processor
sudo systemctl start campanha-processor
sudo systemctl status campanha-processor
```

## 📊 Variáveis de Mensagem

O template da mensagem suporta as seguintes variáveis:

- `{nome}`: Nome do lead
- `{telefone}`: Telefone do lead
- `{data}`: Data atual (formato DD/MM/YYYY)
- `{hora}`: Hora atual (formato HH:MM)

Exemplo:
```
🎉 Olá {nome}! Seja bem-vindo(a) à OralDents! 🦷✨

Data: {data}
Hora: {hora}

Agende sua consulta! 📞
```

## 🔧 Configurações Avançadas

### Rate Limiting

- `DELAY_ENTRE_ENVIOS`: Segundos entre mensagens (padrão: 5)
- `MAX_TENTATIVAS`: Máximo de tentativas (padrão: 3)
- `TIMEOUT_REQUEST`: Timeout das requisições (padrão: 30)

### Logs

O sistema gera dois arquivos de log:
- `campanha_processor.log`: Logs do processador
- `campanha_scheduler.log`: Logs do agendador

## 🚨 Monitoramento

### Verificar Status

```sql
-- Leads por status
SELECT status, COUNT(*) as total 
FROM campanha_leads 
GROUP BY status;

-- Campanha ativa
SELECT * FROM campanhas_config WHERE ativo = true;

-- Leads recentes
SELECT nome, telefone, status, criado_em 
FROM campanha_leads 
ORDER BY criado_em DESC 
LIMIT 10;
```

### Logs de Erro

```python
# Verificar leads com erro
SELECT nome, telefone, erro, atualizado_em 
FROM campanha_leads 
WHERE status = 'erro' 
ORDER BY atualizado_em DESC;
```

## 🛠️ Troubleshooting

### Problemas Comuns:

1. **Mensagens não enviadas**
   - Verificar configuração UAZAPI
   - Verificar se campanha está ativa
   - Verificar logs de erro

2. **Leads não processados**
   - Verificar se agendador está rodando
   - Verificar variáveis de ambiente
   - Verificar conexão com Supabase

3. **Rate Limiting**
   - Aumentar `DELAY_ENTRE_ENVIOS`
   - Verificar limites da UAZAPI

## 📝 Exemplo de Uso Completo

### 1. Configurar Campanha (Frontend)

```javascript
// Ativar campanha
const campanha = {
  nome: "Black Friday Dental",
  mensagem_template: "🛍️ Olá {nome}! Black Friday na OralDents! 🦷✨\n\nAproveite 50% OFF em clareamento!\n\n📞 Agende: (31) 98567-1234",
  ativo: true,
  uazapi_base_url: "https://oralaligner.uazapi.com",
  uazapi_instance_token: "seu_token"
};
```

### 2. Adicionar Lead

```javascript
// Adicionar lead
await fetch('https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/campanha', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sua_chave',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    nome: 'Maria Santos',
    telefone: '31985679876'
  })
});
```

### 3. Processamento Automático

O sistema irá:
1. Receber o lead na Edge Function
2. Salvar na tabela `campanha_leads` com status 'pendente'
3. O processador Python buscará e enviará a mensagem
4. Atualizará o status para 'enviado' ou 'erro'

## 🎯 Benefícios

- ✅ **Automação Total**: Sem intervenção manual
- ✅ **Escalabilidade**: Processa centenas de leads
- ✅ **Confiabilidade**: Tratamento de erros e retentativas
- ✅ **Monitoramento**: Logs completos e status em tempo real
- ✅ **Flexibilidade**: Templates personalizáveis
- ✅ **Performance**: Rate limiting e otimizações

---

## 📞 Suporte

Para dúvidas ou problemas, verifique:
1. Logs do sistema
2. Configurações de ambiente
3. Status da campanha no Supabase
4. Documentação da UAZAPI
