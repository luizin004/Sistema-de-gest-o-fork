# 🚀 Início Rápido - Sistema Integrado

## ⚡ Execução Rápida (Windows)

### Opção 1: Script Automático
Clique duas vezes em: **`iniciar_sistema.bat`**

### Opção 2: Manual

**Terminal 1 - Backend:**
```bash
cd DisparosWhatsapp
python -m uvicorn web_server:app --host 127.0.0.1 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd data-post-orchestrator-main
npm run dev
```

**Acesse:** http://localhost:8080

## 📦 Primeira Instalação

### Backend Python
```bash
cd DisparosWhatsapp
pip install -r requirements.txt
```

Configure `.env`:
```env
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=seu_id
ZAPI_TOKEN=seu_token
CORS_ORIGINS=http://localhost:8080
```

### Frontend React
```bash
cd data-post-orchestrator-main
npm install
```

Configure `.env`:
```env
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave
```

## 🎯 Fluxo de Uso

### 1. Página Inicial
- Escolha entre **Disparos WhatsApp** ou **Agendamentos**

### 2. Disparos WhatsApp
**Formatar Listas:**
1. Upload CSV/Excel
2. Configure formatação (telefone, nome)
3. Adicione filtros (opcional)
4. Baixe CSV formatado

**Enviar Mensagens:**
1. Upload CSV formatado
2. Configure mensagem template
3. Ajuste delay e parâmetros
4. Inicie transmissão
5. Acompanhe progresso
6. Baixe relatórios

### 3. Agendamentos
- Visualize consultas
- Edite data/hora
- Marque presença
- Exporte dados

## 🔧 Portas Utilizadas

- **Backend Python:** 8000
- **Frontend React:** 8080

## ✅ Checklist Pré-Execução

- [ ] Python 3.10+ instalado
- [ ] Node.js 18+ instalado
- [ ] Dependências Python instaladas
- [ ] Dependências Node instaladas
- [ ] Arquivo `.env` configurado no backend
- [ ] Arquivo `.env` configurado no frontend
- [ ] Portas 8000 e 8080 livres

## 🐛 Problemas Comuns

**"Port already in use"**
- Feche outros processos nas portas 8000 ou 8080

**"Module not found"**
- Execute `pip install -r requirements.txt` ou `npm install`

**"CORS error"**
- Verifique `CORS_ORIGINS` no `.env` do backend

**"Cannot connect to backend"**
- Confirme que o backend está rodando na porta 8000

## 📱 URLs do Sistema

- **Home:** http://localhost:8080/
- **Disparos:** http://localhost:8080/disparos
- **Formatação:** http://localhost:8080/formata-listas
- **Agendamentos:** http://localhost:8080/agendamentos
- **CRM:** http://localhost:8080/crm
- **Backend API:** http://localhost:8000/api

## 🌐 Deploy

Veja instruções completas em: **README_INTEGRADO.md**

Opções recomendadas:
- **Backend:** Railway ou Render
- **Frontend:** Lovable, Netlify ou Vercel
