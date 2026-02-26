# 🔍 Troubleshooting - Sistema de Campanhas

## ❓ Problema: "Inseri uma linha na tabela e nada mudou nos leads da campanha"

### 📋 Checklist de Verificação

#### 1️⃣ **Verificar Tabelas no Supabase**

Execute este SQL no Supabase SQL Editor para verificar se as tabelas existem:

```sql
-- Verificar se tabelas existem
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tabela_campanha', 'campanha_leads');

-- Verificar estrutura da tabela de leads
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'campanha_leads' 
ORDER BY ordinal_position;

-- Verificar se há dados
SELECT COUNT(*) as total_campanhas FROM tabela_campanha;
SELECT COUNT(*) as total_leads FROM campanha_leads;
```

#### 2️⃣ **Verificar Campanha Ativa**

```sql
-- Verificar se existe campanha ativa
SELECT * FROM tabela_campanha WHERE ativo = true;

-- Se não existir, ative uma campanha:
UPDATE tabela_campanha 
SET ativo = true 
WHERE id = 'uuid_da_sua_campanha';
```

#### 3️⃣ **Testar Edge Function**

Execute o script de teste:

```bash
cd DisparosWhatsapp
python test_campanha_edge_function.py
```

#### 4️⃣ **Verificar Logs da Edge Function**

No Supabase Dashboard:
1. Vá para `Edge Functions`
2. Clique na função `campanha`
3. Veja os logs em `Logs`

#### 5️⃣ **Testar Inserção Manual**

```sql
-- Inserir lead manualmente para teste
INSERT INTO campanha_leads (nome, telefone, status, campanha_id)
VALUES (
    'Teste Manual', 
    '5531985671234', 
    'pendente', 
    (SELECT id FROM tabela_campanha WHERE ativo = true LIMIT 1)
);

-- Verificar se foi inserido
SELECT * FROM campanha_leads ORDER BY criado_em DESC LIMIT 5;
```

---

## 🔧 Possíveis Causas e Soluções

### ❌ **Causa 1: Tabelas não criadas**
**Sintoma:** Erro 404 ou "relation does not exist"
**Solução:**
```sql
-- Execute o schema completo
-- Conteúdo do arquivo campanha_schema.sql
```

### ❌ **Causa 2: Nenhuma campanha ativa**
**Sintoma:** Edge Function retorna "Nenhuma campanha ativa encontrada"
**Solução:**
```sql
-- Ativar uma campanha existente
UPDATE campanhas_config SET ativo = true WHERE nome = 'Sua Campanha';

-- Ou criar uma nova
INSERT INTO campanhas_config (
    nome, 
    descricao, 
    mensagem_template, 
    ativo,
    uazapi_base_url,
    uazapi_instance_token
) VALUES (
    'Campanha Teste',
    'Campanha para teste',
    'Olá {nome}! Teste de mensagem.',
    true,
    'https://oralaligner.uazapi.com',
    'seu_token_aqui'
);
```

### ❌ **Causa 3: Edge Function não deployada**
**Sintoma:** Erro 404 ou 500 ao chamar a função
**Solução:**
```bash
# Deploy da Edge Function
supabase functions deploy campanha
```

### ❌ **Causa 4: Permissões RLS (Row Level Security)**
**Sintoma:** Erro 403 ou "permission denied"
**Solução:**
```sql
-- Desabilitar RLS temporariamente para teste
ALTER TABLE campanhas_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_leads DISABLE ROW LEVEL SECURITY;

-- Ou criar políticas adequadas
CREATE POLICY "Public insert campanha_leads" ON campanha_leads
FOR INSERT WITH CHECK (true);

CREATE POLICY "Public select campanha_leads" ON campanha_leads
FOR SELECT USING (true);
```

### ❌ **Causa 5: Variáveis de ambiente faltando**
**Sintoma:** Erro 500 nos logs da Edge Function
**Solução:**
No Supabase Dashboard, vá para `Edge Functions` > `campanha` > `Settings` e adicione:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 🧪 Testes Passo a Passo

### Passo 1: Verificar Schema
```bash
# Execute o SQL do arquivo campanha_schema.sql
# Verifique se não houve erros
```

### Passo 2: Criar Campanha Ativa
```sql
INSERT INTO campanhas_config (
    nome, 
    mensagem_template, 
    ativo,
    uazapi_base_url,
    uazapi_instance_token
) VALUES (
    'Campanha Teste',
    'Olá {nome}! Esta é uma mensagem de teste.',
    true,
    'https://oralaligner.uazapi.com',
    'test_token'
);
```

### Passo 3: Testar Edge Function
```bash
python test_campanha_edge_function.py
```

### Passo 4: Verificar Frontend
1. Abra o frontend
2. Vá para `/disparos/campanha/leads`
3. Verifique se os leads aparecem

---

## 🚀 Soluções Rápidas

### Opção A: Reset Completo
```sql
-- Apagar tudo e recomeçar
DROP TABLE IF EXISTS campanha_leads;
DROP TABLE IF EXISTS campanhas_config;

-- Recriar com o schema
-- Execute campanha_schema.sql novamente
```

### Opção B: Teste Simples
```sql
-- Inserir dados de teste diretamente
INSERT INTO campanhas_config (
    nome, 
    mensagem_template, 
    ativo,
    uazapi_base_url,
    uazapi_instance_token
) VALUES (
    'Teste Rápido',
    'Olá {nome}!',
    true,
    'https://oralaligner.uazapi.com',
    'test'
);

INSERT INTO campanha_leads (nome, telefone, status, campanha_id)
VALUES (
    'João Teste', 
    '5531985671234', 
    'pendente', 
    (SELECT id FROM campanhas_config WHERE nome = 'Teste Rápido')
);
```

---

## 📞 Ajuda Adicional

### Verificar com cURL:
```bash
# Testar Edge Function diretamente
curl -X POST "https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/campanha" \
  -H "Authorization: Bearer SUA_CHAVE_ANON" \
  -H "Content-Type: application/json" \
  -d '{"nome": "Teste cURL", "telefone": "31985671234"}'
```

### Verificar no Browser:
1. Abra DevTools (F12)
2. Vá para Network tab
3. Tente adicionar um lead pelo frontend
4. Veja a requisição e resposta

---

## 🎯 Próximos Passos

1. ✅ Execute o checklist acima
2. ✅ Identifique a causa exata
3. ✅ Aplique a solução correspondente
4. ✅ Teste novamente
5. ✅ Verifique no frontend

Se após todos os testes ainda não funcionar, o problema pode estar:
- Na configuração do Supabase
- Na rede/firewall
- Em permissões da conta

**Execute os testes na ordem sugerida e me diga qual erro específico aparece!**
