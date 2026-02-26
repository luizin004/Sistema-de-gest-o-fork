# Guia Completo do Supabase - Produto Genérico (Baseado em MCP)

## Visão Geral

Este documento descreve a arquitetura completa do backend Supabase para um produto SaaS genérico de comunicação via WhatsApp, incluindo estrutura de tabelas, Edge Functions, e suas interações. Todas as informações foram obtidas diretamente do Supabase MCP (Managed Cloud Platform).

## Estrutura do Banco de Dados

### Tabelas Principais

#### 1. `posts`
**Propósito**: Tabela principal de leads/clientes do sistema
```sql
CREATE TABLE posts (
  id text PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  status text,
  data timestamptz,
  horario text,
  tratamento text,
  author_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  telefone text,
  dentista text,
  data_marcada timestamptz,
  feedback text,
  campanha_id integer,
  campanha_nome varchar,
  agendamento_id uuid,
  ultima_mensagem_at timestamp,
  nao_respondeu boolean DEFAULT false
);

-- Chaves estrangeiras
FOREIGN KEY (agendamento_id) REFERENCES agendamento(id),
FOREIGN KEY (campanha_id) REFERENCES tabela_campanha(id);
```

**Por que existe**: Armazena todos os leads e clientes que interagem com o sistema, permitindo rastreamento completo do funil de vendas e comunicação.

#### 2. `agendamento`
**Propósito**: Gerencia agendamentos de consultas/tarefas
```sql
CREATE TABLE agendamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  horario text,
  telefone text UNIQUE,
  dentista text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  author_id uuid NOT NULL,
  data timestamptz,
  data_marcada timestamptz,
  presenca text,
  confirmado boolean DEFAULT false,
  source text COMMENT 'Origem: codefy/manual',
  tratamento text
);
```

**Por que existe**: Centraliza todos os agendamentos, permitindo gestão eficiente da agenda e integração com sistemas externos.

#### 3. `chat_messages`
**Propósito**: Histórico de mensagens do chat
```sql
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text NOT NULL,
  direction text CHECK (direction IN ('incoming', 'outgoing')),
  message_id text,
  sender_name text,
  created_at timestamptz DEFAULT now()
);
```

**Por que existe**: Mantém registro completo de todas as conversas para análise e compliance.

#### 4. `disparos`
**Propósito**: Base de clientes para campanhas automáticas
```sql
CREATE TABLE disparos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL,
  data_nascimento date,
  data_limpeza date,
  data_clareamento date,
  data_consulta date,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  disparo_automatico_enviado boolean DEFAULT false,
  data_ultimo_disparo date,
  ativo boolean DEFAULT true
);
```

**Por que existe**: Armazena dados de clientes para campanhas de marketing automatizadas (aniversário, limpeza, clareamento, consulta).

#### 5. `campanhas`
**Propósito**: Configuração de campanhas de marketing
```sql
CREATE TABLE campanhas (
  id text PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  mensagem_template text,
  status text DEFAULT 'pausada',
  enviar_audio_vazio boolean DEFAULT false,
  arquivo_audio_personalizado text,
  created_at timestamptz DEFAULT now()
);
```

**Por que existe**: Permite criação e gestão de campanhas personalizadas com templates de mensagem e configurações de áudio.

#### 6. `tabela_campanha`
**Propósito**: Leads específicos de campanhas
```sql
CREATE TABLE tabela_campanha (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  telefone text NOT NULL,
  instagram text,
  idade integer,
  funcao text,
  empresa text NOT NULL,
  ID_campanha text,
  disparo_feito boolean DEFAULT false,
  extras jsonb,
  criado_em timestamptz DEFAULT now(),
  agendado_para timestamptz,
  audio_enviado boolean DEFAULT false,
  audio_erro text,
  audio_enviado_em timestamptz
);
```

**Por que existe**: Armazena leads capturados em campanhas específicas com controle de envio e agendamento.

#### 7. `disparos_config`
**Propósito**: Configurações de disparos automáticos
```sql
CREATE TABLE disparos_config (
  id integer PRIMARY KEY,
  tipo text NOT NULL,
  mensagem_template text NOT NULL,
  ativo boolean DEFAULT true,
  dias_antes integer,
  -- Campos Z-API
  zapi_instance_id text,
  zapi_token text,
  zapi_client_token text
);
```

**Por que existe**: Configura quando e como enviar mensagens automáticas para diferentes tipos de campanha.

#### 8. `uazapi_chat_messages`
**Propósito**: Mensagens integradas com UAZAPI
```sql
CREATE TABLE uazapi_chat_messages (
  id text PRIMARY KEY,
  lead_id text,
  phone_number text NOT NULL,
  direction text NOT NULL,
  content text,
  media_url text,
  media_type text,
  status text,
  provider_id text,
  message_type text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Por que existe**: Integração completa com WhatsApp via UAZAPI, suportando texto, mídia e metadados.

#### 9. `scheduler_lock`
**Propósito**: Controle de concorrência de schedulers
```sql
CREATE TABLE scheduler_lock (
  id integer PRIMARY KEY DEFAULT 1,
  ativo boolean DEFAULT false,
  inicio timestamptz,
  fim timestamptz,
  source text
);
```

**Por que existe**: Evita execuções concorrentes de jobs agendados.

#### 10. `disparos_automaticos_log`
**Propósito**: Log de envios automáticos
```sql
CREATE TABLE disparos_automaticos_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  cliente_id uuid,
  telefone text,
  mensagem text NOT NULL,
  data_disparo timestamptz DEFAULT now(),
  status text NOT NULL,
  resposta_zapi jsonb
);
```

**Por que existe**: Auditoria completa de todas as mensagens automáticas enviadas.

#### 11. `arquivados`
**Propósito**: Leads arquivados (soft delete)
```sql
CREATE TABLE arquivados (
  id text PRIMARY KEY,
  nome text,
  status text,
  data timestamptz,
  horario text,
  tratamento text,
  author_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  telefone text,
  dentista text,
  data_marcada timestamptz,
  feedback text,
  campanha_id integer,
  campanha_nome varchar,
  agendamento_id uuid,
  ultima_mensagem_at timestamp,
  nao_respondeu boolean DEFAULT false,
  archived_at timestamptz DEFAULT now(),
  archived_by uuid
);
```

**Por que existe**: Mantém histórico de leads removidos sem deletar permanentemente.

#### 12. `lead_historico`
**Propósito**: Histórico completo de leads
```sql
CREATE TABLE lead_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_normalizado text UNIQUE NOT NULL,
  nome text NOT NULL,
  telefone_original text,
  status_final text,
  -- Dados de posts
  posts_id text,
  posts_status text,
  posts_data timestamptz,
  posts_horario text,
  posts_tratamento text,
  posts_dentista text,
  posts_data_marcada timestamptz,
  posts_feedback text,
  posts_campanha_id integer,
  posts_campanha_nome text,
  posts_ultima_mensagem_at timestamp,
  posts_nao_respondeu boolean,
  -- Dados de arquivados
  arquivados_id uuid,
  arquivados_original_id text,
  arquivados_status text,
  arquivados_data timestamptz,
  arquivados_horario text,
  arquivados_tratamento text,
  arquivados_dentista text,
  arquivados_data_marcada timestamptz,
  arquivados_feedback text,
  arquivados_campanha_id integer,
  arquivados_campanha_nome text,
  arquivados_archived_at timestamptz,
  arquivados_archived_by uuid,
  -- Dados de agendamento
  agendamento_id uuid,
  agendamento_data timestamptz,
  agendamento_horario text,
  agendamento_dentista text,
  agendamento_tratamento text,
  agendamento_data_marcada timestamptz,
  agendamento_presenca text,
  agendamento_confirmado boolean,
  agendamento_source text,
  -- Controle
  primeira_interacao timestamptz,
  ultima_atualizacao timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
```

**Por que existe**: Centraliza todo o histórico de um lead em um único registro para análise completa.

#### 13. `lead_historico_eventos`
**Propósito**: Eventos do histórico de leads
```sql
CREATE TABLE lead_historico_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_normalizado text NOT NULL,
  passagem_id uuid NOT NULL,
  evento text NOT NULL,
  dados jsonb DEFAULT '{}',
  criado_em timestamptz DEFAULT now()
);
```

**Por que existe**: Rastreia cada mudança no status do lead para análise de jornada.

#### 14. `dentistas`
**Propósito**: Cadastro de profissionais
```sql
CREATE TABLE dentistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  especialidade text COMMENT 'Especialidade odontológica',
  cor_hex text DEFAULT '#8B5CF6' CHECK (cor_hex ~ '^#[0-9A-Fa-f]{6}$'),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Por que existe**: Gerencia profissionais com especialidades e identificação visual.

#### 15. `consultorios`
**Propósito**: Cadastro de consultórios
```sql
CREATE TABLE consultorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  numero integer UNIQUE COMMENT 'Número do consultório (1-4)',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Por que existe**: Controla espaços físicos para agendamentos.

#### 16. `escala_semanal`
**Propósito**: Escala de horários
```sql
CREATE TABLE escala_semanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dentista_id uuid NOT NULL,
  consultorio_id uuid NOT NULL,
  dia_semana integer CHECK (dia_semana >= 1 AND dia_semana <= 6),
  horario_inicio time NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  semana integer DEFAULT 1
);
```

**Por que existe**: Define disponibilidade de profissionais por consultório e dia.

#### 17. `employee_metrics`
**Propósito**: Métricas de performance
```sql
CREATE TABLE employee_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  employee_source text NOT NULL,
  avg_idle_time_seconds numeric DEFAULT 0,
  median_idle_time_seconds numeric DEFAULT 0,
  min_idle_time_seconds numeric DEFAULT 0,
  max_idle_time_seconds numeric DEFAULT 0,
  total_idle_time_seconds numeric DEFAULT 0,
  first_message_time time,
  last_message_time time,
  work_duration_minutes integer DEFAULT 0,
  messages_per_hour numeric DEFAULT 0,
  morning_messages integer DEFAULT 0,
  afternoon_messages integer DEFAULT 0,
  evening_messages integer DEFAULT 0,
  night_messages integer DEFAULT 0,
  total_messages integer DEFAULT 0,
  unique_clients integer DEFAULT 0,
  peak_hour integer,
  peak_hour_messages integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Por que existe**: Analisa produtividade e padrões de comunicação da equipe.

## Edge Functions

### 1. `posts-api`
**Propósito**: API CRUD para leads/posts
```typescript
// Normaliza telefone para formato padrão
const normalizePhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned === "") return null;
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
};
```

**Por que existe**: Fornece endpoints padronizados para gerenciar leads com normalização automática de telefones.

**Endpoints**:
- `POST /` - Criar novo lead
- `GET /` - Listar leads (com filtro por telefone)
- `PATCH /` - Atualizar lead

### 2. `uazapi-chat`
**Propósito**: Integração completa com WhatsApp via UAZAPI
```typescript
// Configuração UAZAPI
const UAZAPI_CONFIG = {
  url: "https://oralaligner.uazapi.com/send/text",
  token: "a5cd00c3-2394-47ff-a6cb-f39e02603da6",
  agentNumber: "553181036689",
};

// Normalização de telefone com múltiplas variantes
function buildPhoneVariants(rawPhone: string): string[] {
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return [];
  const variants = new Set<string>();
  variants.add(normalized);
  variants.add(`+${normalized}`);
  if (normalized.startsWith("55")) {
    variants.add(normalized.substring(2));
    variants.add(`0${normalized.substring(2)}`);
  }
  return Array.from(variants).filter(Boolean);
}
```

**Por que existe**: Gerencia toda a comunicação via WhatsApp, incluindo:
- Recebimento de mensagens inbound
- Envio de mensagens outbound
- Processamento de mídia (áudio, imagem, vídeo)
- Deduplicação de mensagens
- Atualização automática de status de leads

**Funcionalidades**:
- Webhook para receber mensagens do UAZAPI
- API para enviar mensagens via CRM
- Detecção automática de leads existentes
- Trigger assíncrono para processamento de mídia

### 3. `disparos-scheduler`
**Propósito**: Agendamento de envios automáticos
```typescript
const UAZAPI_CONFIG = {
  url: 'https://oralaligner.uazapi.com/send/text',
  token: 'fcd2612d-6b25-4c8f-aace-29df197301ff',
};

// Lógica de agendamento por tipo
const targetClients = clients?.filter(client => {
  if (!client[dateField]) return false;
  const clientDate = new Date(client[dateField]);
  const clientDateString = clientDate.toISOString().split('T')[0];
  const targetDateString = targetDate.toISOString().split('T')[0];
  
  if (tipo === 'aniversario') {
    return clientDate.getMonth() === targetDate.getMonth() &&
           clientDate.getDate() === targetDate.getDate();
  }
  
  return clientDateString === targetDateString;
});
```

**Por que existe**: Automatiza envios de mensagens baseados em datas específicas:
- Aniversários (verifica mês/dia)
- Limpezas (data específica)
- Clareamentos (data específica)
- Consultas (data específica)

**Funcionalidades**:
- Busca configuração na tabela `disparos_config`
- Filtra clientes por data alvo
- Personaliza mensagens com templates
- Envia via UAZAPI
- Registra log de cada envio

### 4. `campanha-scheduler`
**Propósito**: Processamento de campanhas ativas
```typescript
// Verificação de horário comercial
const horaUTC = agora.getUTCHours();
const horaBrasilia = ((horaUTC - 3) % 24 + 24) % 24;
if (horaBrasilia < 9 || horaBrasilia >= 19) {
  return new Response(JSON.stringify({ 
    message: 'Fora do horário permitido (09h–19h Brasília)',
    skipped: true 
  }));
}

// Sistema de lock para evitar concorrência
const { data: lockData } = await supabase
  .from('scheduler_lock')
  .select('id, updated_at, ativo')
  .eq('id', 1)
  .single();
```

**Por que existe**: Processa leads de campanhas de forma controlada:
- Respeita horário comercial (9h-19h)
- Usa sistema de lock para evitar duplicação
- Processa um lead por execução
- Suporte a áudio personalizado
- Retry automático em caso de falha

**Funcionalidades**:
- Lock por 30-60 segundos aleatórios
- Verificação de campanha ativa
- Envio de mensagem + áudio opcional
- Atualização de status em tempo real
- Controle de tentativas e falhas

### 5. `cadastro-campanhas`
**Propósito**: CRUD completo de campanhas
```typescript
interface CampanhaRequest {
  id?: string;
  nome?: string;
  descricao?: string;
  mensagem_template?: string;
  status?: string;
  enviar_audio_vazio?: boolean;
  arquivo_audio_personalizado?: string | null;
}

// Validação de ID único
const { data: existingCampaign } = await supabaseClient
  .from('campanhas')
  .select('id')
  .eq('id', body.id)
  .single();

if (existingCampaign) {
  return new Response(JSON.stringify({ 
    error: `ID ${body.id} já está em uso` 
  }), { status: 409 });
}
```

**Por que existe**: Gerencia o ciclo de vida completo das campanhas:
- Criação com validação de ID único
- Atualização de configurações
- Exclusão segura
- Listagem com ordenação

**Endpoints**:
- `GET /` - Listar campanhas
- `POST /` - Criar campanha
- `PUT/PATCH /` - Atualizar campanha
- `DELETE /` - Excluir campanha

### 6. `disparos-brumadinho`
**Propósito**: Processamento de CSV e envio para Google Sheets
```typescript
// Formatação de telefone para Google Sheets
function formatPhoneForSheets(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
  
  if (withDDI.length === 13) {
    return withDDI.substring(0, 4) + withDDI.substring(5);
  }
  
  return withDDI;
}

// URLs das planilhas por tipo
const SHEETS_URLS = {
  aniversario: 'https://script.google.com/macros/s/...',
  limpeza: 'https://script.google.com/macros/s/...',
  clareamento: 'https://script.google.com/macros/s/...',
  confirmacao: 'https://script.google.com/macros/s/...'
};
```

**Por que existe**: Processa uploads de CSV e integra com Google Sheets:
- Parse de CSV com validação
- Formatação de telefones para Sheets
- Envio individual para planilhas específicas
- Suporte a múltiplos tipos de campanha

**Funcionalidades**:
- Upload de arquivos CSV
- Processamento de registros individuais
- Formatação automática de telefones
- Integração com Google Apps Script

### 7. `mover-nao-respondeu`
**Propósito**: Identificar leads inativos
```typescript
// Busca leads que não responderam há 20min
const vinteMinAtras = new Date(Date.now() - 20 * 60 * 1000);

const { data: leadsParaMover } = await supabase
  .from('posts')
  .select('id, nome, status, ultima_mensagem_at, updated_at, nao_respondeu')
  .in('status', ['respondeu', 'interagiu', 'engajou'])
  .eq('nao_respondeu', false)
  .or(`ultima_mensagem_at.lt.${vinteMinAtras.toISOString()},
        updated_at.lt.${vinteMinAtras.toISOString()}`);
```

**Por que existe**: Automatiza identificação de leads frios:
- Verifica inatividade de 20 minutos
- Considera apenas status de interação
- Marca flag sem alterar status original
- Mantém histórico para análise

### 8. `campanha-metricas`
**Propósito**: Cálculo de métricas de campanhas
```typescript
// Cache simples em memória
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Agrupamento por campanha
const campanhaStats = new Map<string, {
  total: number;
  responderam: number;
  naoResponderam: number;
  taxaResposta: string;
  leads: any[];
}>();

campanhaLeads?.forEach(lead => {
  const campanhaId = lead.ID_campanha || 'sem_campanha';
  // ... lógica de agrupamento
});
```

**Por que existe**: Fornece análise de performance das campanhas:
- Cache de 5 minutos para performance
- Cálculo de taxas de resposta
- Agrupamento por campanha
- Estatísticas gerais e individuais

**Funcionalidades**:
- Cache automático para performance
- Endpoint para limpar cache
- Cálculo de taxas de resposta
- Agrupamento por ID de campanha

### 9. `toggle-disparos`
**Propósito**: Controle de ativação/desativação
```typescript
// Usa RPC functions do Supabase
if (action === 'status') {
  const { data, error } = await supabase.rpc('get_disparos_status');
  return new Response(JSON.stringify({ active: data }));
}

if (action === 'pause' || action === 'resume') {
  const active = action === 'resume';
  const { error } = await supabase.rpc('toggle_campanha_disparos', { 
    p_active: active 
  });
}
```

**Por que existe**: Controla remotely a execução de campanhas:
- Verifica status atual
- Pausa/retorna disparos
- Usa RPC functions do Supabase

### 10. `process-whatsapp-media`
**Propósito**: Descriptografia e upload de mídia WhatsApp
```typescript
// Descriptografia usando HKDF + AES-CBC
async function decryptWhatsAppMedia(
  encryptedData: ArrayBuffer,
  mediaKeyBase64: string,
  infoType: string
): Promise<Uint8Array> {
  const mediaKeyBuffer = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0));
  
  const importedKey = await crypto.subtle.importKey(
    "raw", mediaKeyBuffer, { name: "HKDF" }, false, ["deriveKey", "deriveBits"]
  );
  
  // ... processo de descriptografia
}
```

**Por que existe**: Processa mídia criptografada do WhatsApp:
- Descriptografa áudios, imagens, vídeos
- Faz upload para Supabase Storage
- Atualiza URL na tabela de mensagens
- Suporta todos os formatos de mídia

**Funcionalidades**:
- Descriptografia HKDF + AES-CBC
- Upload automático para storage
- Geração de URLs públicas
- Suporte a todos os tipos de mídia

### 11. `zapi-send-message`
**Propósito**: Envio de mensagens via webhook
```typescript
// Normalização para DDD + 8 dígitos
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const number = digits.slice(3);
    digits = ddd + number;
  }
  return digits;
}
```

**Por que existe**: Envia mensagens via webhook externo:
- Formata telefone para padrão webhook
- Envia para automation webhook
- Suporte a mensagens manuais

### 12. `export-to-sheets` / `scheduled-export`
**Propósito**: Exportação de dados para Google Sheets
```typescript
// Autenticação JWT para Google Sheets
async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  
  // ... geração e assinatura do JWT
}
```

**Por que existe**: Exporta agendamentos para Google Sheets:
- Autenticação via Service Account
- Limpeza e reescrita de dados
- Suporte a exportações manuais e agendadas

## Configurações de Ambiente

### Variáveis Obrigatórias
```bash
# Supabase
SUPABASE_URL=your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# UAZAPI
UAZAPI_URL=https://your-instance.uazapi.com/send/text
UAZAPI_TOKEN=your-token
UAZAPI_MEDIA_URL=https://your-instance.uazapi.com/send/media

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SPREADSHEET_ID=your-sheet-id

# Webhooks
MANUAL_MESSAGE_WEBHOOK_URL=https://your-webhook-url.com
WEBHOOK_URL=https://your-forwarding-url.com
```

## Relacionamentos e Fluxos

### Fluxo de Campanha
1. **Cadastro**: `cadastro-campanhas` cria campanha em `campanhas`
2. **Captura**: Leads entram em `tabela_campanha` via webhooks
3. **Processamento**: `campanha-scheduler` envia mensagens via UAZAPI
4. **Métricas**: `campanha-metricas` calcula performance

### Fluxo de Disparos Automáticos
1. **Configuração**: `disparos_config` define templates e prazos
2. **Agendamento**: `disparos-scheduler` roda periodicamente
3. **Envio**: Mensagens via UAZAPI
4. **Log**: `disparos_automaticos_log` registra tudo

### Fluxo de WhatsApp
1. **Recebimento**: `uazapi-chat` recebe webhook
2. **Armazenamento**: Salva em `uazapi_chat_messages`
3. **Processamento**: `process-whatsapp-media` para mídia
4. **Atualização**: Atualiza lead em `posts`

### Fluxo de Agendamentos
1. **Criação**: Via frontend em `agendamento`
2. **Exportação**: `export-to-sheets` para Google Sheets
3. **Agendado**: `scheduled-export` periódico

## Considerações de Performance

### Indexação Recomendada
```sql
-- Otimizações importantes
CREATE INDEX idx_posts_telefone ON posts(telefone);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_ultima_mensagem ON posts(ultima_mensagem_at);
CREATE INDEX idx_tabela_campanha_disparo ON tabela_campanha(disparo_feito);
CREATE INDEX idx_uazapi_messages_phone ON uazapi_chat_messages(phone_number);
CREATE INDEX idx_uazapi_messages_provider ON uazapi_chat_messages(provider_id);
```

### Estratégias de Cache
- `campanha-metricas`: Cache de 5 minutos em memória
- `scheduler_lock`: Previne execuções concorrentes
- Supabase RLS: Cache automático de consultas

## Segurança

### Row Level Security (RLS)
- Tabelas com dados sensíveis usam RLS
- `posts`: Restrito por author_id
- `agendamento`: Restrito por author_id
- Edge Functions usam SERVICE_ROLE quando necessário

### Autenticação
- JWT tokens para usuários
- Service Role Key para operações system
- Webhook tokens para UAZAPI

## Monitoramento

### Logs Importantes
- Todas as Edge Functions fazem console.log
- Logs de erro em `disparos_automaticos_log`
- Métricas em `employee_metrics`

### Health Checks
- `toggle-disparos` para status
- `campanha-scheduler` com lock
- Webhooks respondem 200 OK

## Escalabilidade

### Horizontal Scaling
- Edge Functions escalam automaticamente
- Scheduler com lock previne duplicação
- Cache reduz carga no banco

### Vertical Scaling
- Supabase PostgreSQL auto-escala
- Storage ilimitado para mídia
- CDN automático para assets

## Backup e Recuperação

### Point-in-Time Recovery
- Supabase mantém 30 dias
- Logs de todas as operações
- Exportações manuais disponíveis

### Export de Dados
- Google Sheets para agendamentos
- CSV exports via frontend
- API completa para backup custom

## Cron Jobs e Agendamentos

### Visão Geral dos Agendamentos

O sistema utiliza múltiplos cron jobs para automatizar processos críticos. Todos os schedulers são implementados como Edge Functions do Supabase com mecanismos de controle de concorrência e retry automático.

### 1. Campanha Scheduler
**Function**: `campanha-scheduler`
**Cron**: `*/10 * * * *` (a cada 10 minutos)
**Propósito**: Processar leads de campanhas ativas

```typescript
// Verificação de horário comercial (9h-19h Brasília)
const horaUTC = agora.getUTCHours();
const horaBrasilia = ((horaUTC - 3) % 24 + 24) % 24;
if (horaBrasilia < 9 || horaBrasilia >= 19) {
  return new Response(JSON.stringify({ 
    message: 'Fora do horário permitido (09h–19h Brasília)',
    skipped: true 
  }));
}

// Sistema de lock para evitar concorrência
const { data: lockData } = await supabase
  .from('scheduler_lock')
  .select('id, updated_at, ativo')
  .eq('id', 1)
  .single();

if (lockData && lockData.ativo === true) {
  return new Response(JSON.stringify({ 
    message: 'Already running', 
    skipped: true 
  }));
}
```

**Funcionalidades**:
- ✅ Respeita horário comercial Brasileiro
- ✅ Lock por 30-60 segundos aleatórios
- ✅ Processa um lead por execução
- ✅ Suporte a áudio personalizado
- ✅ Retry automático com controle de tentativas
- ✅ Verificação de campanha ativa antes do envio

### 2. Disparos Scheduler
**Function**: `disparos-scheduler`
**Cron**: `0 8 * * *` (diário às 8h)
**Propósito**: Enviar mensagens automáticas baseadas em datas

```typescript
// Cálculo de data alvo baseado no tipo
const today = new Date();
const targetDate = new Date(today);
targetDate.setDate(today.getDate() + config.dias_antes);

// Lógica específica para aniversários
if (tipo === 'aniversario') {
  return clientDate.getMonth() === targetDate.getMonth() &&
         clientDate.getDate() === targetDate.getDate();
}

// Para outros tipos, compara data exata
return clientDateString === targetDateString;
```

**Tipos de Disparo**:
- 🎂 **Aniversário**: Verifica mês/dia (configurável X dias antes)
- 🦷 **Limpeza**: Data específica (configurável X dias antes)
- ✨ **Clareamento**: Data específica (configurável X dias antes)
- 📅 **Consulta**: Data específica (configurável X dias antes)

**Funcionalidades**:
- ✅ Busca configuração em `disparos_config`
- ✅ Personalização de templates
- ✅ Envio via UAZAPI
- ✅ Log individual de cada envio
- ✅ Delay de 1 segundo entre mensagens

### 3. Mover Não Respondeu
**Function**: `mover-nao-respondeu`
**Cron**: `*/5 * * * *` (a cada 5 minutos)
**Propósito**: Identificar leads inativos há 20 minutos

```typescript
// Busca leads que não responderam há 20min
const vinteMinAtras = new Date(Date.now() - 20 * 60 * 1000);

const { data: leadsParaMover } = await supabase
  .from('posts')
  .select('id, nome, status, ultima_mensagem_at, updated_at, nao_respondeu')
  .in('status', ['respondeu', 'interagiu', 'engajou'])
  .eq('nao_respondeu', false)
  .or(`ultima_mensagem_at.lt.${vinteMinAtras.toISOString()},
        updated_at.lt.${vinteMinAtras.toISOString()}`);
```

**Funcionalidades**:
- ✅ Verifica inatividade de 20 minutos
- ✅ Apenas status de interação
- ✅ Marca flag sem alterar status
- ✅ Mantém histórico para análise

### 4. Scheduled Export
**Function**: `scheduled-export`
**Cron**: `0 0 * * *` (diário à meia-noite)
**Propósito**: Exportar agendamentos para Google Sheets

```typescript
// Autenticação JWT para Google Sheets
async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  
  // Geração e assinatura do JWT
}
```

**Funcionalidades**:
- ✅ Exportação diária automática
- ✅ Autenticação via Service Account
- ✅ Limpeza e reescrita de dados
- ✅ Todos os agendamentos (sem filtro de usuário)

### Configuração dos Cron Jobs

#### Via Supabase Dashboard
```bash
# 1. Acessar Supabase Project
# 2. Ir para Edge Functions
# 3. Configurar cron jobs para cada função

# Exemplos de configuração:
campanha-scheduler:     "*/10 * * * *"  # Cada 10 min
disparos-scheduler:     "0 8 * * *"      # Diário 8h
mover-nao-respondeu:    "*/5 * * * *"     # Cada 5 min
scheduled-export:       "0 0 * * *"       # Diário meia-noite
```

#### Via CLI Supabase
```bash
# Criar job
supabase functions deploy campanha-scheduler --no-verify-jwt
supabase functions deploy disparos-scheduler --no-verify-jwt

# Configurar cron (exemplo via dashboard)
# Não há CLI direta para cron, usar dashboard
```

### Mecanismos de Controle

#### 1. Scheduler Lock
```sql
-- Tabela de controle de concorrência
CREATE TABLE scheduler_lock (
  id integer PRIMARY KEY DEFAULT 1,
  ativo boolean DEFAULT false,
  inicio timestamptz,
  fim timestamptz,
  source text
);
```

**Propósito**: Evitar execuções concorrentes do mesmo job

#### 2. Retry e Tolerância a Falhas
```typescript
// Controle de tentativas no campanha-scheduler
const tentativas = lead.extras?.tentativas || 0;
if (tentativas >= 3) {
  // Marca como pulado após 3 falhas
  await supabase.from('tabela_campanha')
    .update({ 
      extras: { 
        ...lead.extras, 
        pulado_disparo: true, 
        motivo_pulado: 'muitas_falhas'
      } 
    })
    .eq('id', lead.id);
  return;
}
```

#### 3. Rate Limiting
```typescript
// Delay entre mensagens no disparos-scheduler
await new Promise(resolve => setTimeout(resolve, 1000));

// Delay aleatório no campanha-scheduler
const randomDelay = Math.floor(Math.random() * 31) + 30;
await new Promise(resolve => setTimeout(resolve, randomDelay * 1000));
```

### Monitoramento dos Cron Jobs

#### 1. Logs de Execução
```typescript
// Logs estruturados em todas as funções
console.log(`[${new Date().toISOString()}] [SCHEDULER] Iniciando execução...`);
console.log(`[${new Date().toISOString()}] [SCHEDULER] Processando lead ID: ${lead.id}`);
console.log(`[${new Date().toISOString()}] [SCHEDULER] Execução concluída com sucesso!`);
```

#### 2. Health Checks
```bash
# Verificar status via toggle-disparos
curl -X POST https://your-project.supabase.co/functions/v1/toggle-disparos \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -d '{"action": "status"}'

# Verificar logs via Supabase Dashboard
# Edge Functions > Functions > View Logs
```

#### 3. Métricas de Performance
```sql
-- Verificar execuções recentes
SELECT * FROM scheduler_lock 
WHERE updated_at > NOW() - INTERVAL '1 hour' 
ORDER BY updated_at DESC;

-- Verificar logs de disparos
SELECT tipo, COUNT(*) as total, 
       COUNT(CASE WHEN status = 'enviado' THEN 1 END) as sucessos,
       COUNT(CASE WHEN status = 'erro' THEN 1 END) as erros
FROM disparos_automaticos_log 
WHERE data_disparo > NOW() - INTERVAL '24 hours'
GROUP BY tipo;
```

### Configurações Avançadas

#### 1. Variáveis de Ambiente para Cron
```bash
# Configurações de tempo
CAMPAHA_SCHEDULE_INTERVAL=*/10 * * * *
DISPAROS_SCHEDULE_TIME=0 8 * * *
NAO_RESPONDEU_INTERVAL=*/5 * * * *
EXPORT_SCHEDULE_TIME=0 0 * * *

# Timeouts e retries
SCHEDULER_TIMEOUT_SECONDS=300
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY_SECONDS=60

# Limites de processamento
MAX_LEADS_PER_RUN=50
RATE_LIMIT_DELAY_MS=1000
```

#### 2. Configurações de Fuse (Cron Job Limiting)
```typescript
// Controle de processamento por execução
const MAX_LEADS_PER_RUN = 50;
const leads = await supabase
  .from('tabela_campanha')
  .select('*')
  .eq('disparo_feito', false)
  .limit(MAX_LEADS_PER_RUN);
```

#### 3. Failover e Recovery
```typescript
// Recuperação automática de locks antigos
const lockTimeout = new Date(Date.now() - 10 * 60 * 1000); // 10 min

if (lockData && lockData.ativo === true && 
    new Date(lockData.updated_at) < lockTimeout) {
  // Força liberação de lock "preso"
  await supabase.from('scheduler_lock')
    .update({ ativo: false, fim: new Date().toISOString() })
    .eq('id', 1);
}
```

### Boas Práticas

#### 1. Idempotência
```typescript
// Verificar se processamento já foi feito
if (lead.disparo_feito) {
  continue; // Pular já processado
}

// Registrar início do processamento
await supabase.from('tabela_campanha')
  .update({ processando_em: new Date().toISOString() })
  .eq('id', lead.id);
```

#### 2. Graceful Shutdown
```typescript
// Liberar lock sempre, mesmo em erro
try {
  // Lógica principal
  await processarLead(lead);
} catch (error) {
  console.error('Erro no processamento:', error);
} finally {
  // Sempre liberar o lock
  await supabase.from('scheduler_lock')
    .update({ ativo: false, fim: new Date().toISOString() })
    .eq('id', 1);
}
```

#### 3. Alertas e Notificações
```typescript
// Enviar alerta em caso de falhas consecutivas
if (consecutiveFailures >= 5) {
  await sendAlert({
    type: 'scheduler_failure',
    function: 'campanha-scheduler',
    failures: consecutiveFailures,
    timestamp: new Date().toISOString()
  });
}
```

### Tabela Resumo de Cron Jobs

| Job | Frequência | Horário | Propósito | Lock | Retry |
|-----|------------|---------|-----------|------|-------|
| `campanha-scheduler` | */10 min | 9h-19h | Processar leads de campanhas | ✅ | ✅ |
| `disparos-scheduler` | Diário | 8h | Enviar mensagens automáticas | ❌ | ✅ |
| `mover-nao-respondeu` | */5 min | Todo dia | Marcar leads inativos | ❌ | ❌ |
| `scheduled-export` | Diário | 0h | Exportar para Google Sheets | ❌ | ✅ |

## Conclusão

Esta arquitetura fornece uma base robusta e escalável para um produto SaaS de comunicação via WhatsApp, com:
- ✅ Gestão completa de leads
- ✅ Campanhas automatizadas
- ✅ Integração WhatsApp nativa
- ✅ Análise e métricas
- ✅ Alta disponibilidade
- ✅ Segurança e compliance
- ✅ Cron jobs automatizados
- ✅ Controle de concorrência
- ✅ Monitoramento e alertas

O sistema está pronto para ser replicado e customizado para diferentes verticais de negócio, mantendo a integridade e performance.
