# Integração FormataLista + Disparos WhatsApp

## O que foi feito

Integrei o programa **FormataLista** (desktop Tkinter) com o **sistema de Disparos WhatsApp** em uma interface web unificada.

## Estrutura

### Backend (FastAPI)
- **`formata_lista_routes.py`**: Rotas API para formatação de listas
  - `POST /api/formata-lista/upload`: Upload de CSV/Excel
  - `POST /api/formata-lista/processar/{session_id}`: Processar e baixar
  - `DELETE /api/formata-lista/session/{session_id}`: Limpar sessão

- **`api_routes.py`**: Rotas API para disparos WhatsApp (já existente)
  - `POST /api/upload`: Upload CSV para disparos
  - `POST /api/start`: Iniciar transmissão
  - `GET /api/status/{job_id}`: Status da transmissão

### Frontend (HTML/CSS/JS)
- **`index.html`**: Interface unificada com sistema de abas
- **`styles.css`**: Estilos modernos com suporte a abas
- **`tabs.js`**: Gerenciamento de navegação entre abas
- **`formata.js`**: Lógica do FormataLista (upload, processamento, filtros)
- **`app.js`**: Lógica dos Disparos WhatsApp (já existente)

## Funcionalidades

### Aba 1: Formatar Listas 📋
1. Upload de arquivos CSV, XLSX ou XLS
2. Detecção automática de colunas (nome, telefone, cidade)
3. Configuração de formatação:
   - **Telefone**: DDI (55), DDD, nono dígito (auto/incluir/remover)
   - **Nome**: Nome completo ou apenas primeiro nome
4. Sistema de filtros:
   - Filtrar por cidade, nome ou telefone
   - Operadores: igual ou contém
   - Múltiplos filtros simultâneos
5. Download do CSV formatado

### Aba 2: Disparos WhatsApp 📤
1. Upload do CSV formatado (ou qualquer CSV com nome, telefone, cidade)
2. Configuração da mensagem template com variáveis
3. Controle de delay, timeout, lotes e horário comercial
4. Acompanhamento em tempo real
5. Download de relatórios e logs

## Como usar

1. **Instalar dependências**:
```bash
pip install -r requirements.txt
```

2. **Configurar `.env`** (copiar de `.env.example`):
```
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=seu_instance_id
ZAPI_TOKEN=seu_token
```

3. **Subir o servidor**:
```bash
python -m uvicorn web_server:app --host 127.0.0.1 --port 8001
```

4. **Acessar**: http://127.0.0.1:8001

## Fluxo de trabalho recomendado

1. **Formatar Listas**: Faça upload do seu arquivo bruto (CSV/Excel), configure a formatação e filtros, baixe o CSV formatado
2. **Disparos WhatsApp**: Faça upload do CSV formatado, configure a mensagem e inicie os disparos

## Tecnologias

- **Backend**: FastAPI, Pandas, Python
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Integrações**: Z-API (WhatsApp)
- **Suporte**: CSV, XLSX, XLS

## Arquivos principais criados/modificados

### Criados:
- `formata_lista_routes.py`
- `static/formata.js`
- `static/tabs.js`
- `INTEGRACAO.md`

### Modificados:
- `web_server.py` (adicionou router do FormataLista)
- `static/index.html` (interface com abas)
- `static/styles.css` (estilos para abas e filtros)
- `requirements.txt` (adicionou openpyxl e xlrd)
- `README.md` (documentação atualizada)

## Observações

- O FormataLista original (Tkinter) continua funcionando independentemente na pasta `FormataLista/`
- A versão web usa os mesmos módulos de processamento do FormataLista
- Ambos os sistemas compartilham o mesmo servidor FastAPI
- Interface responsiva e moderna com feedback visual
