# � Migração ZAPI → UAZAPI - STATUS CRÍTICO

## 📋 Resumo da Migração

**ATENÇÃO:** A migração está muito mais incompleta do que se pensava! Descobrimos que **múltiplas funcionalidades críticas** ainda dependem de Z-API.

## ⚠️ **STATUS ATUAL: MIGRAÇÃO APENAS 25% CONCLUÍDA**

### ✅ **Funcionalidades Migradas (Backend Manual)**
- [x] Disparos em massa (CSV → WhatsApp)
- [x] Disparos manuais (página DisparosManual)
- [x] Sistema de jobs e processamento em lote

### ❌ **Funcionalidades NÃO Migradas (CRÍTICO)**
- [ ] **Chat do CRM** (usa Edge Function `zapi-send-message`)
- [ ] **Disparos agendados automáticos** (aniversário, limpeza, clareamento, confirmação)
- [ ] **Webhooks** de recebimento de mensagens
- [ ] **Edge Functions** do Supabase
- [ ] **Configurações de agendamentos** (interfaces TypeScript)

## 🚨 **IMPACTO CRÍTICO TOTAL**

Se você desativar Z-API agora:
- ✅ **Disparos manuais funcionarão** (UAZAPI)
- ❌ **Chat do CRM vai parar completamente** (ainda Z-API)
- ❌ **Disparos agendados vão parar completamente** (ainda Z-API)
- ❌ **Recebimento de mensagens vai parar completamente** (ainda Z-API)
- ❌ **Sistema de lembretes automáticos vai parar** (ainda Z-API)

**RESULTADO: 75% do sistema ficará inoperante!**

## ✅ Tarefas Concluídas

### 📦 Backup dos Arquivos
- [x] `config_loader.py.backup`
- [x] `integrations.py.backup`
- [x] `job_runner.py.backup`
- [x] `main.py.backup`

### 🔧 Atualizações do Código

#### 1. `config_loader.py`
- [x] Substituídas variáveis ZAPI_* por UAZAPI_*
- [x] URL atualizada para formato UAZAPI
- [x] Removida dependência de instance_id

**Antes:**
```python
ZAPI_BASE_URL, ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN
url = f"{base_url}/instances/{instance_id}/token/{token}/send-text"
```

**Depois:**
```python
UAZAPI_BASE_URL, UAZAPI_INSTANCE_TOKEN, UAZAPI_ADMIN_TOKEN
url = f"{base_url}/send-message"
```

#### 2. `integrations.py`
- [x] Função `enviar_zapi()` → `enviar_uazapi()`
- [x] Payload: `phone` → `number`
- [x] Headers: `Client-Token` → `Authorization: Bearer token`

#### 3. `job_runner.py`
- [x] Variável `zapi_client_token` → `uazapi_instance_token`
- [x] URL `ZAPI_SEND_TEXT_URL` → `UAZAPI_SEND_MESSAGE_URL`
- [x] Chamadas de função atualizadas

#### 4. `main.py`
- [x] Descrição atualizada para "Disparo WhatsApp (UAZAPI)"
- [x] Variáveis de ambiente atualizadas
- [x] Chamadas de função atualizadas

### 🧪 Testes e Validação
- [x] Script de teste `test_uazapi.py` criado
- [x] Validação de configuração funcionando
- [x] Sistema reconhecendo variáveis UAZAPI

## 🚨 **LIMITAÇÕES CRÍTICAS E PLANO COMPLETO**

### 📋 **O que falta migrar (75% do sistema):**

#### 1. **Edge Function `zapi-send-message`** 🔴 CRÍTICO
- **Localização:** Supabase Dashboard → Edge Functions
- **Problema:** Chat do CRM ainda usa Z-API
- **Arquivo afetado:** `data-post-orchestrator-main/src/components/WhatsAppChat.tsx` (linha 181)
- **Código atual:** `supabase.functions.invoke('zapi-send-message')`

#### 2. **Disparos Agendados Automáticos** 🔴 CRÍTICO
- **Tipos:** Aniversário, Limpeza, Clareamento, Confirmação
- **Arquivos afetados:**
  - `DisparosAniversarioConfig.tsx`
  - `DisparosLimpezaConfig.tsx`
  - `DisparosClareamentoConfig.tsx`
  - `DisparosConfirmacaoConfig.tsx`
- **Problema:** Interfaces ainda usam `zapi_instance_id`, `zapi_token`, `zapi_client_token`

#### 3. **Webhooks de Recebimento** 🟡 IMPORTANTE
- **Problema:** Mensagens recebidas ainda vão para Z-API
- **Impacto:** Chat do CRM não recebe mensagens
- **Solução:** Configurar webhooks UAZAPI

#### 4. **Configurações no Supabase** 🟡 IMPORTANTE
- **Tabela:** `disparos_config`
- **Campos:** `zapi_instance_id`, `zapi_token`, `zapi_client_token`
- **Ação:** Migrar campos para UAZAPI

### 🛠️ **Plano de Conclusão OBRIGATÓRIO:**

#### **FASE 1: Frontend/TypeScript (IMEDIATO)**
1. **Migrar interfaces** TypeScript para UAZAPI
2. **Atualizar formulários** de configuração
3. **Mudar chamadas** frontend para `uazapi-send-message`

#### **FASE 2: Edge Functions (CRÍTICO)**
1. **Criar** Edge Function `uazapi-send-message`
2. **Migrar** lógica de Z-API para UAZAPI
3. **Testar** chat do CRM

#### **FASE 3: Webhooks e Backend (IMPORTANTE)**
1. **Configurar** webhooks UAZAPI
2. **Atualizar** endpoints de recebimento
3. **Migrar** dados do Supabase

#### **FASE 4: Testes Finais (VALIDAÇÃO)**
1. **Testar** chat do CRM completo
2. **Validar** disparos agendados
3. **Verificar** sincronização de mensagens

### ⚠️ **NÃO DESATIVE Z-API EM HIPÓTESE ALGUMA!**

**Risco:** Quebra de 75% do sistema incluindo chat, agendamentos e webhooks.

**Recomendação:** Complete TODAS as fases antes de qualquer desativação.

## 🚀 **Próximos Passos (Backend já OK)**

### 1. Configurar Instância UAZAPI
```bash
# Criar instância (se ainda não tiver)
curl --request POST \
  --url https://free.uazapi.com/instance/init \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "oralaligner-brumadinho",
    "systemName": "oralaligner"
  }'
```

### 2. Configurar Variáveis de Ambiente
Crie/atualize o arquivo `.env`:
```bash
# Configurações UAZAPI
UAZAPI_BASE_URL=https://oralaligner.uazapi.com
UAZAPI_INSTANCE_TOKEN=SEU_INSTANCE_TOKEN_AQUI
UAZAPI_ADMIN_TOKEN=SEU_ADMIN_TOKEN_AQUI

# Opcional: número para testes
TEST_PHONE_NUMBER=5531999998888
```

### 3. Conectar Instância
```bash
# Conectar com número de telefone (recomendado)
curl --request POST \
  --url https://free.uazapi.com/instance/connect \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer SEU_INSTANCE_TOKEN' \
  --data '{
    "phone": "5531999998888"
  }'
```

### 4. Testar Sistema
```bash
# Executar script de teste
python test_uazapi.py

# Testar configuração
python -c "from config_loader import carregar_env; print(carregar_env())"
```

## 🔄 Rollback (Se necessário)

Se precisar voltar para ZAPI:
```bash
# Restaurar arquivos
cp config_loader.py.backup config_loader.py
cp integrations.py.backup integrations.py
cp job_runner.py.backup job_runner.py
cp main.py.backup main.py

# Restaurar .env (se tiver backup)
cp .env.backup .env
```

## 📊 Mudanças Técnicas

### Formato do Payload
| ZAPI | UAZAPI |
|------|--------|
| `{"phone": "5511999999999", "message": "Olá"}` | `{"number": "5511999999999", "message": "Olá"}` |

### Autenticação
| ZAPI | UAZAPI |
|------|--------|
| `Client-Token: token` | `Authorization: Bearer token` |

### URL Structure
| ZAPI | UAZAPI |
|------|--------|
| `/instances/{id}/token/{token}/send-text` | `/send-message` |

## 🎯 Benefícios da Migração

1. **Domínio Próprio**: `oralaligner.uazapi.com`
2. **Performance Melhorada**: Infraestrutura otimizada
3. **Mais Recursos**: Business API, catalog management
4. **Suporte Brasileiro**: Time zone e idioma localizados
5. **Webhooks Avançados**: Mais eventos e filtros disponíveis

## 📚 Documentação Adicional

- [Documentação UAZAPI completa](./UAZAPI_AI_Documentation.md)
- [Script de testes](./DisparosWhatsapp/test_uazapi.py)
- [README para Windsurf](./WINDSURF_UAZAPI_MIGRATION_README.md)

## ⚠️ Notas Importantes

1. **Rate Limits**: UAZAPI pode ter limites diferentes - monitore as respostas 429
2. **Error Codes**: Códigos de status podem ser diferentes dos ZAPI
3. **Webhooks**: Se usar webhooks, configure-os novamente na UAZAPI
4. **Tokens**: Guarde os tokens UAZAPI em local seguro

## 🎉 **Status: MIGRAÇÃO CRÍTICA (25% CONCLUÍDA)**

### ✅ **Backend Manual:** 100% migrado para UAZAPI
### ❌ **Frontend/Agendados/Edge Functions:** 0% migrado (ainda Z-API)

**Conclusão:** Apenas disparos manuais estão prontos para UAZAPI. Chat do CRM, disparos agendados e webhooks ainda dependem completamente de Z-API.

**AÇÃO CRÍTICA:** Complete a migração das Edge Functions e Configurações de Agendamentos antes de desativar Z-API!

---

## 📋 **CHECKLIST DE MIGRAÇÃO COMPLETA:**

### ✅ **FASE 1 - Backend Manual (CONCLUÍDA)**
- [x] `config_loader.py` migrado
- [x] `integrations.py` migrado  
- [x] `job_runner.py` migrado
- [x] `main.py` migrado

### ❌ **FASE 2 - Frontend/TypeScript (PENDENTE)**
- [ ] Migrar interfaces TypeScript
- [ ] Atualizar formulários de agendamentos
- [ ] Mudar chamadas do chat CRM

### ❌ **FASE 3 - Edge Functions (PENDENTE)**
- [ ] Criar `uazapi-send-message`
- [ ] Migrar lógica Z-API → UAZAPI
- [ ] Testar chat do CRM

### ❌ **FASE 4 - Webhooks/Backend (PENDENTE)**
- [ ] Configurar webhooks UAZAPI
- [ ] Migrar dados Supabase
- [ ] Testar sincronização

**PROGRESSO TOTAL: 1/4 fases concluídas (25%)**

---

*Data: 27/01/2026*  
*Status: 🚨 Migração Crítica (25%) - Apenas Backend Manual Migrado*
