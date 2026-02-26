# Sistema Integrado - Disparos WhatsApp + Agendamentos

Sistema completo que unifica:
- **Formatação de Listas**: Processa arquivos CSV/Excel com filtros e formatação
- **Disparos WhatsApp**: Envio em massa de mensagens personalizadas via Z-API
- **Agendamentos**: Gestão de consultas odontológicas com Supabase

## 📋 Requisitos

### Backend (Python)
- Python 3.10+
- pip

### Frontend (React)
- Node.js 18+ 
- npm ou bun

## 🚀 Instalação

### 1. Backend Python (DisparosWhatsapp)

```bash
cd DisparosWhatsapp
pip install -r requirements.txt
```

Configure o arquivo `.env`:
```env
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=seu_instance_id
ZAPI_TOKEN=seu_token
API_KEY=sua_chave_opcional
CORS_ORIGINS=http://localhost:8080
```

### 2. Frontend React (data-post-orchestrator-main)

```bash
cd data-post-orchestrator-main
npm install
```

Configure o arquivo `.env`:
```env
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_supabase
```

## 🎯 Executando Localmente

### Passo 1: Iniciar Backend Python (porta 8000)

```bash
cd DisparosWhatsapp
python -m uvicorn web_server:app --host 127.0.0.1 --port 8000
```

### Passo 2: Iniciar Frontend React (porta 8080)

Em outro terminal:

```bash
cd data-post-orchestrator-main
npm run dev
```

### Passo 3: Acessar o Sistema

Abra o navegador em: **http://localhost:8080**

## 📱 Estrutura do Sistema

### Página Inicial (/)
- Escolha entre **Disparos WhatsApp** ou **Agendamentos**
- Design moderno com cards interativos

### Módulo Disparos (/disparos)
- **Aba Formatar Listas**: Acesso rápido à formatação
- **Aba Disparos WhatsApp**: 
  - Upload de CSV
  - Configuração de mensagens com templates
  - Controle de delay e horário comercial
  - Progresso em tempo real
  - Download de relatórios e logs

### Formatação de Listas (/formata-listas)
- Upload de CSV/Excel
- Formatação de telefones (DDI, DDD, nono dígito)
- Formatação de nomes
- Sistema de filtros avançado
- Download do arquivo processado

### Agendamentos (/agendamentos)
- Listagem de consultas
- Edição de data/hora
- Controle de presença
- Exportação para Google Sheets e CSV

## 🌐 Deploy para Produção

### Backend Python

**Opção 1: Railway**
1. Crie conta no [Railway](https://railway.app)
2. Conecte seu repositório
3. Configure as variáveis de ambiente
4. Deploy automático

**Opção 2: Render**
1. Crie conta no [Render](https://render.com)
2. New Web Service
3. Conecte o repositório
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn web_server:app --host 0.0.0.0 --port $PORT`

### Frontend React

**Opção 1: Lovable (Recomendado)**
1. Acesse [Lovable](https://lovable.dev)
2. Importe o projeto
3. Configure variáveis de ambiente
4. Publish

**Opção 2: Netlify**
```bash
cd data-post-orchestrator-main
npm run build
# Deploy a pasta dist/
```

**Opção 3: Vercel**
```bash
cd data-post-orchestrator-main
npm run build
vercel --prod
```

### Configuração Pós-Deploy

1. **Atualize o proxy no frontend**:
   - Edite `vite.config.ts`
   - Altere `target: 'http://localhost:8000'` para a URL do seu backend em produção

2. **Configure CORS no backend**:
   - Atualize `CORS_ORIGINS` no `.env` com a URL do frontend em produção

3. **Variáveis de Ambiente**:
   - Backend: `ZAPI_BASE_URL`, `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`
   - Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## 🔧 Arquitetura

```
┌─────────────────────────────────────────┐
│         Frontend React (Vite)           │
│              Porta 8080                 │
│  ┌─────────────────────────────────┐   │
│  │  Home Page                      │   │
│  │  ├─ Disparos WhatsApp           │   │
│  │  │  ├─ Formatar Listas          │   │
│  │  │  └─ Enviar Mensagens         │   │
│  │  └─ Agendamentos                │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │ Proxy /api/*
               ▼
┌─────────────────────────────────────────┐
│      Backend Python (FastAPI)           │
│              Porta 8000                 │
│  ┌─────────────────────────────────┐   │
│  │  /api/formata/*                 │   │
│  │  /api/upload                    │   │
│  │  /api/start                     │   │
│  │  /api/status/{job_id}           │   │
│  │  /api/stop/{job_id}             │   │
│  │  /api/report/{job_id}           │   │
│  │  /api/log/{job_id}              │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
               ▼
         ┌──────────┐
         │  Z-API   │
         │ WhatsApp │
         └──────────┘
```

## 📝 Funcionalidades

### Formatação de Listas
- ✅ Upload de CSV, XLSX, XLS
- ✅ Detecção automática de colunas
- ✅ Formatação de telefones (DDI, DDD, 9º dígito)
- ✅ Formatação de nomes
- ✅ Filtros por cidade, nome ou telefone
- ✅ Preview dos dados
- ✅ Download do CSV formatado

### Disparos WhatsApp
- ✅ Upload de CSV formatado
- ✅ Templates de mensagem com variáveis
- ✅ Controle de delay entre mensagens
- ✅ Timeout configurável
- ✅ Sistema de lotes
- ✅ Pausa entre lotes
- ✅ Horário comercial (Seg-Sex 8-18h, Sáb 9-12h)
- ✅ Progresso em tempo real
- ✅ Relatório de sucesso/erro
- ✅ Log detalhado

### Agendamentos
- ✅ Listagem de consultas
- ✅ Edição de data/hora
- ✅ Controle de confirmação
- ✅ Controle de presença
- ✅ Exportação para Google Sheets
- ✅ Exportação para CSV
- ✅ Atualização em tempo real (Supabase Realtime)

## 🎨 Design

O sistema foi desenvolvido com:
- **shadcn/ui**: Componentes modernos e acessíveis
- **Tailwind CSS**: Estilização responsiva
- **Lucide Icons**: Ícones consistentes
- **Gradientes suaves**: Visual profissional
- **Animações**: Transições fluidas
- **Dark/Light Mode**: Suporte a temas

## 🔐 Segurança

- Variáveis de ambiente para dados sensíveis
- API Key opcional para proteger endpoints
- CORS configurável
- Validação de entrada
- Sanitização de dados

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do backend
2. Verifique o console do navegador
3. Confirme as variáveis de ambiente
4. Teste as APIs individualmente

## 🚨 Troubleshooting

### Backend não inicia
- Verifique se a porta 8000 está livre
- Confirme que todas as dependências estão instaladas
- Valide o arquivo `.env`

### Frontend não conecta ao backend
- Verifique se o backend está rodando
- Confirme o proxy no `vite.config.ts`
- Verifique CORS no backend

### Disparos não funcionam
- Valide credenciais Z-API
- Verifique formato do CSV
- Confirme que o telefone está no formato correto

### Agendamentos não aparecem
- Valide credenciais Supabase
- Verifique se a tabela `agendamento` existe
- Confirme as permissões no Supabase

## 📄 Licença

Este projeto é proprietário e de uso interno.
