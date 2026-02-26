# Sistema de Formatação e Disparos WhatsApp

Sistema completo para formatação de listas de leads e envio automatizado de mensagens via WhatsApp usando a Z-API, respeitando um delay configurável.

## Requisitos

- Python 3.10+ (recomendado)

## Instalação

```bash
pip install -r requirements.txt
```

## Configuração

1. Copie o arquivo `.env.example` para `.env` e preencha os valores:

- `ZAPI_BASE_URL`
- `ZAPI_INSTANCE_ID`
- `ZAPI_TOKEN`

2. Ajuste `config.json`:

- `message_template`: mensagem com interpolação (ex: `Olá {nome}...`)
- `delay_seconds`: tempo entre contatos
- `request_timeout_seconds`: timeout das requisições

## CSV de entrada

Crie um arquivo `contatos.csv` na raiz do projeto contendo ao menos as colunas:

- `nome`
- `telefone`
- `cidade`

Outras colunas podem existir e podem ser usadas na mensagem (template).

## Execução

```bash
python main.py --input contatos.csv --output relatorio_final.csv
```

## Execução via Web (UI no navegador)

1. Instale as dependências:

```bash
pip install -r requirements.txt
```

2. Configure o `.env` (copie do `.env.example`).

3. Suba o servidor:

```bash
python -m uvicorn web_server:app --host 127.0.0.1 --port 8000
```

4. Abra no navegador:

- `http://127.0.0.1:8000/`

## Funcionalidades

### Formatar Listas
- Upload de arquivos CSV, XLSX e XLS
- Detecção automática de colunas (nome, telefone, cidade)
- Formatação configurável de telefones (DDI, DDD, nono dígito)
- Formatação de nomes (primeiro nome ou nome completo)
- Sistema de filtros por cidade, nome ou telefone
- Download do CSV formatado

### Disparos WhatsApp
Na interface você consegue:

**Aba "Formatar Listas":**
- Fazer upload de CSV/Excel
- Configurar formatação de telefones e nomes
- Adicionar filtros personalizados
- Processar e baixar CSV formatado

**Aba "Disparos WhatsApp":**
- Fazer upload do CSV formatado
- Configurar mensagem e parâmetros
- Iniciar/parar transmissão
- Acompanhar progresso em tempo real
- Baixar relatórios e logs detalhados

### Interface Web Moderna
- Sistema de abas para alternar entre funcionalidades
- Design responsivo e intuitivo
- Feedback visual em tempo real

Se você quiser criar/hostear um frontend no Lovable, as rotas já estão em `/api/*`:

- `POST /api/upload` (multipart/form-data, campo `file`)
- `POST /api/start` (JSON: `job_id`, `message_template`, `delay_seconds`, `request_timeout_seconds`)
- `GET /api/status/{job_id}`
- `GET /api/report/{job_id}`
- `GET /api/log/{job_id}`

### Segurança (recomendado em produção)

- `API_KEY` (opcional): se definido no `.env`, exige header `x-api-key` em todas as rotas `/api/*`.
- `CORS_ORIGINS` (opcional): defina o domínio do seu frontend (ex: `https://seuapp.lovable.app`).

Arquivos gerados:

- `execucao.log`: log de sucesso/erro por contato
- `relatorio_final.csv`: cópia do CSV com a coluna extra `status` (`sucesso` ou `erro`)

## Observações importantes

- O telefone é limpo automaticamente (remove espaços, parênteses, traços, etc.), ficando apenas números.
- O status é considerado `sucesso` somente se **WhatsApp (Z-API)** retornar HTTP 2xx.
