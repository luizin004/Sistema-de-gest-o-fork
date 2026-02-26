# 🔧 Corrigir Erro de Deploy no Railway

## ❌ Erro: "There was an error deploying from source"

Este erro geralmente acontece porque o Railway está tentando fazer deploy da raiz do projeto, que contém múltiplas pastas.

## ✅ Solução: Configurar Root Directory

### Para o Backend (Python/FastAPI)

1. No Railway, clique no serviço que deu erro
2. Vá em **Settings**
3. Procure por **Root Directory** ou **Source**
4. Configure: `DisparosWhatsapp`
5. Salve e faça **Redeploy**

### Para o Frontend (React/Vite)

1. No Railway, clique no serviço
2. Vá em **Settings**
3. Configure **Root Directory**: `data-post-orchestrator-main`
4. Configure **Build Command**: `npm install && npm run build`
5. Configure **Start Command**: `npm run preview`
6. Salve e faça **Redeploy**

## 🎯 Passo a Passo Detalhado

### Opção 1: Reconfigurar Serviço Existente

1. **Acesse o Railway Dashboard**
2. Clique no projeto que deu erro
3. Clique no serviço (vai aparecer "Failed" ou "Error")
4. Vá em **Settings** (ícone de engrenagem)
5. Role até encontrar **Source** ou **Root Directory**
6. Digite: `DisparosWhatsapp` (para backend) ou `data-post-orchestrator-main` (para frontend)
7. Clique em **Deploy** > **Redeploy**

### Opção 2: Criar Novo Serviço (Recomendado)

Se não encontrar a opção de Root Directory, delete o serviço e crie novamente:

#### Backend:
1. **New Service** > **GitHub Repo**
2. Selecione: `luizin004/brumadinho-sistema`
3. **IMPORTANTE:** Antes de confirmar, clique em **Advanced Settings**
4. Configure:
   - **Root Directory**: `DisparosWhatsapp`
   - **Build Command**: (deixe vazio, o Nixpacks detecta automaticamente)
   - **Start Command**: (deixe vazio, usa o Procfile)
5. Clique em **Deploy**

#### Frontend:
1. **New Service** > **GitHub Repo**
2. Selecione: `luizin004/brumadinho-sistema`
3. **Advanced Settings**:
   - **Root Directory**: `data-post-orchestrator-main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run preview`
4. Clique em **Deploy**

## 🔍 Verificar se Funcionou

### Backend deve mostrar:
```
✓ Installing Python dependencies
✓ Found Procfile
✓ Starting uvicorn
✓ Application startup complete
```

### Frontend deve mostrar:
```
✓ Installing dependencies
✓ Building with Vite
✓ Build complete
✓ Preview server started
```

## ⚙️ Variáveis de Ambiente (Não Esqueça!)

### Backend:
```env
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=seu_instance_id
ZAPI_TOKEN=seu_token
SUPABASE_URL=https://wtqhpovjntjbjhobqttk.supabase.co
SUPABASE_KEY=sua_chave
ENVIRONMENT=production
CORS_ORIGINS=*
```

### Frontend:
```env
VITE_SUPABASE_URL=https://wtqhpovjntjbjhobqttk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave
VITE_BACKEND_URL=https://seu-backend.railway.app
```

## 🐛 Outros Erros Comuns

### "Python version not found"
- Verifique se o arquivo `runtime.txt` existe em `DisparosWhatsapp/`
- Deve conter: `python-3.11.0`

### "Module not found"
- Verifique se `requirements.txt` está completo
- Verifique se está na pasta `DisparosWhatsapp/`

### "Port already in use"
- O Railway define a porta via variável `$PORT`
- Verifique se o Procfile usa: `--port $PORT`

### "Build failed"
- Veja os logs completos clicando em "View Logs"
- Copie o erro e me envie para análise

## 📞 Precisa de Ajuda?

Me envie:
1. Screenshot do erro
2. Logs completos do deploy
3. Qual serviço (backend ou frontend)

---

**Dica:** Sempre configure o Root Directory ANTES de fazer o primeiro deploy!
