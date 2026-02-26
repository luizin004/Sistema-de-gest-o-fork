# Deploy do Frontend no Railway

## Configuração Atual

O frontend está configurado para deploy no Railway com as seguintes otimizações:

### Arquivos de Configuração

1. **`railway.json`** - Configuração principal do Railway
2. **`nixpacks.toml`** - Configuração avançada do build
3. **`vite.config.ts`** - Configuração do Vite com suporte a preview em produção

## Passo a Passo para Deploy

### 1. Preparar o Repositório

Certifique-se de que todos os arquivos estão commitados:

```bash
git add .
git commit -m "Configurar deploy do frontend no Railway"
git push
```

### 2. Criar Projeto no Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha o repositório do projeto
5. Selecione a pasta `data-post-orchestrator-main` (se necessário)

### 3. Configurar Variáveis de Ambiente

No painel do Railway, adicione as seguintes variáveis:

```env
VITE_SUPABASE_PROJECT_ID=wtqhpovjntjbjhobqttk
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts
VITE_SUPABASE_URL=https://wtqhpovjntjbjhobqttk.supabase.co
VITE_BACKEND_URL=https://brumadinho-sistema-production.up.railway.app
```

**Importante:** O Railway define automaticamente a variável `PORT`, não é necessário configurá-la.

### 4. Deploy Automático

O Railway detectará automaticamente os arquivos de configuração e:

1. Instalará as dependências com `npm ci`
2. Executará o build com `npm run build`
3. Iniciará o servidor com `npm run preview`

### 5. Verificar Deploy

Após o deploy:

1. Acesse a URL fornecida pelo Railway
2. Verifique se o frontend está carregando corretamente
3. Teste a conexão com o backend

## Configurações Técnicas

### railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm run preview -- --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### nixpacks.toml

```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run preview -- --host 0.0.0.0 --port $PORT"
```

### vite.config.ts - Preview

```typescript
preview: {
  host: "0.0.0.0",
  port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
  strictPort: false,
}
```

## Troubleshooting

### Erro: Port Already in Use

- O Railway gerencia automaticamente as portas
- Verifique se a configuração `strictPort: false` está no `vite.config.ts`

### Erro: Build Failed

- Verifique se todas as dependências estão no `package.json`
- Confirme que o `node_modules` não está no repositório
- Revise os logs de build no painel do Railway

### Frontend não conecta ao Backend

- Verifique se `VITE_BACKEND_URL` está correta
- Confirme que o backend está rodando
- Verifique CORS no backend

## Redeploy

Para fazer redeploy:

1. Faça commit das alterações
2. Push para o GitHub
3. O Railway fará deploy automático

Ou use o botão **"Redeploy"** no painel do Railway.

## Domínio Customizado

Para adicionar domínio próprio:

1. Vá em **Settings** > **Domains**
2. Clique em **"Add Domain"**
3. Configure o DNS conforme instruções

## Monitoramento

- **Logs**: Acesse a aba "Deployments" > "View Logs"
- **Métricas**: Veja uso de CPU, memória e rede na aba "Metrics"
- **Status**: Monitore o status do serviço no dashboard

## Custos

- Railway oferece $5 de crédito gratuito por mês
- Após isso, cobra por uso (CPU, memória, rede)
- Monitore o uso no painel de billing
