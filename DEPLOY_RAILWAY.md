# 🚀 Deploy no Railway - Guia Completo

## 📋 Pré-requisitos

1. Conta no Railway (https://railway.app)
2. Conta no GitHub (para conectar o repositório)
3. Credenciais do Supabase configuradas
4. Credenciais da Z-API

## 🏗️ Estrutura do Projeto

O projeto está dividido em 2 serviços:

- **Backend Python (DisparosWhatsapp)** - API FastAPI
- **Frontend React (data-post-orchestrator-main)** - Interface web

## 📦 Passo 1: Preparar o Repositório GitHub

### 1.1 Criar repositório no GitHub

```bash
# No diretório do projeto
cd c:\Users\admin\Desktop\LAMORIA\Brumadinho

# Adicionar remote (substitua SEU_USUARIO pelo seu usuário do GitHub)
git remote add origin https://github.com/SEU_USUARIO/brumadinho-sistema.git

# Push para o GitHub
git push -u origin main
```

## 🔧 Passo 2: Deploy do Backend (Python)

### 2.1 Criar novo projeto no Railway

1. Acesse https://railway.app
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Escolha o repositório que você criou
5. Selecione a pasta **DisparosWhatsapp** como root directory

### 2.2 Configurar variáveis de ambiente

No Railway Dashboard, vá em **Variables** e adicione:

```env
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=seu_instance_id_aqui
ZAPI_TOKEN=seu_token_aqui
SUPABASE_URL=https://wtqhpovjntjbjhobqttk.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts
API_KEY=sua_api_key_opcional
CORS_ORIGINS=*
ENVIRONMENT=production
PORT=8000
```

### 2.3 Configurar domínio

1. Após o deploy, copie a URL gerada (ex: `https://seu-backend.railway.app`)
2. Anote essa URL para usar no frontend

## 🎨 Passo 3: Deploy do Frontend (React)

### 3.1 Criar segundo serviço no Railway

1. No mesmo projeto Railway, clique em "New Service"
2. Selecione "Deploy from GitHub repo"
3. Escolha o mesmo repositório
4. Selecione a pasta **data-post-orchestrator-main** como root directory

### 3.2 Configurar variáveis de ambiente

No Railway Dashboard do frontend, vá em **Variables** e adicione:

```env
VITE_SUPABASE_PROJECT_ID=wtqhpovjntjbjhobqttk
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts
VITE_SUPABASE_URL=https://wtqhpovjntjbjhobqttk.supabase.co
VITE_BACKEND_URL=https://seu-backend.railway.app
```

**IMPORTANTE:** Substitua `https://seu-backend.railway.app` pela URL real do seu backend.

### 3.3 Configurar build command

No Railway, vá em **Settings** > **Build Command** e configure:

```bash
npm install && npm run build
```

No **Start Command**:

```bash
npm run preview
```

## 🗄️ Passo 4: Configurar Supabase Storage

### 4.1 Criar bucket no Supabase

1. Acesse https://supabase.com/dashboard
2. Vá em **Storage**
3. Clique em "Create bucket"
4. Nome: `disparos-files`
5. Marque como **Public** (ou configure políticas de acesso)

### 4.2 Configurar políticas de acesso

Execute no SQL Editor do Supabase:

```sql
-- Permitir upload de arquivos
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'disparos-files');

-- Permitir leitura de arquivos
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'disparos-files');

-- Permitir exclusão de arquivos
CREATE POLICY "Allow public deletes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'disparos-files');
```

## 🔗 Passo 5: Configurar Webhooks da Z-API

1. Acesse o painel da Z-API
2. Configure o webhook para: `https://seu-backend.railway.app/webhook/zapi`
3. Teste o webhook enviando uma mensagem

## ✅ Passo 6: Testar o Deploy

### 6.1 Testar Backend

```bash
curl https://seu-backend.railway.app/health
```

Deve retornar: `{"status": "ok"}`

### 6.2 Testar Frontend

Acesse: `https://seu-frontend.railway.app`

### 6.3 Testar Upload de Arquivos

1. Acesse a página de Disparos WhatsApp
2. Faça upload de um arquivo CSV/Excel
3. Verifique se aparece no Supabase Storage

## 🔄 Atualizações Futuras

Para atualizar o sistema:

```bash
# Fazer alterações no código
git add .
git commit -m "Descrição das mudanças"
git push origin main
```

O Railway fará deploy automático das mudanças.

## 💰 Custos Estimados

- **Railway**: ~$5-10/mês (plano gratuito: $5 de crédito)
- **Supabase**: Gratuito até 500MB de storage
- **Total**: ~$5-10/mês

## 🐛 Troubleshooting

### Erro: "Module not found"

Verifique se todas as dependências estão no `requirements.txt` (backend) ou `package.json` (frontend).

### Erro: "CORS policy"

Adicione a URL do frontend no `CORS_ORIGINS` do backend.

### Erro: "Cannot upload file"

Verifique se o bucket `disparos-files` existe no Supabase e se as políticas de acesso estão configuradas.

### Logs do Railway

Para ver logs de erro:
1. Acesse o projeto no Railway
2. Clique no serviço (Backend ou Frontend)
3. Vá em **Deployments** > **View Logs**

## 📞 Suporte

Se precisar de ajuda, verifique:
- Logs do Railway
- Console do navegador (F12)
- Documentação do Railway: https://docs.railway.app
- Documentação do Supabase: https://supabase.com/docs

---

**Criado em:** 19 de Dezembro de 2025  
**Versão:** 1.0
