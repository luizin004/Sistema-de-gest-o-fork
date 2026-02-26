# Configuração Z-API no Railway

## ✅ Sistema Funcionando!

O frontend e backend estão operacionais. Agora você precisa configurar as credenciais da Z-API no Railway.

## Variáveis de Ambiente Necessárias

Acesse o painel do Railway do **backend** e adicione as seguintes variáveis de ambiente:

### 1. ZAPI_BASE_URL
URL base da sua instância Z-API
```
https://api.z-api.io
```

### 2. ZAPI_INSTANCE_ID
ID da sua instância Z-API
```
Exemplo: 3C12345678901234567890AB
```

### 3. ZAPI_TOKEN
Token da sua instância Z-API
```
Exemplo: A1B2C3D4E5F6G7H8I9J0
```

### 4. ZAPI_CLIENT_TOKEN
Client token da sua instância Z-API (obrigatório)
```
Exemplo: F9E8D7C6B5A4321098765432
```

## Como Configurar no Railway

1. Acesse [railway.app](https://railway.app)
2. Selecione o projeto do **backend** (brumadinho-sistema-production)
3. Vá em **Variables**
4. Clique em **+ New Variable**
5. Adicione cada variável acima com seus valores reais
6. O Railway fará redeploy automático

## Onde Obter as Credenciais

1. Acesse o painel da Z-API: https://painel.z-api.io
2. Selecione sua instância
3. Vá em **Configurações** ou **API**
4. Copie os valores:
   - Instance ID
   - Token
   - Client Token

## Testando

Após configurar as variáveis:

1. Aguarde o redeploy do Railway (1-2 minutos)
2. Faça upload de um CSV no sistema
3. Configure a mensagem
4. Inicie o disparo
5. Verifique os logs - não deve mais aparecer "client-token is not configured"

## Erro Atual

```
{"error":"your client-token is not configured"}
```

Isso significa que `ZAPI_CLIENT_TOKEN` não está definido no Railway.

## Estrutura da URL Gerada

O sistema monta automaticamente a URL:
```
{ZAPI_BASE_URL}/instances/{ZAPI_INSTANCE_ID}/token/{ZAPI_TOKEN}/send-text
```

## Segurança

⚠️ **NUNCA** commite as credenciais no código!
- Use apenas variáveis de ambiente
- As credenciais ficam seguras no Railway
- Não compartilhe os tokens publicamente
