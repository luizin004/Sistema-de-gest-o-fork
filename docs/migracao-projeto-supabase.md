# Migração de Projeto Supabase

## De: wtqhpovjntjbjhobqttk → Para: wjsbyahzwdupsmopygkg

## 🔄 Passos da Migração

### 1. Backup do Projeto Antigo
```sql
-- Exportar dados importantes
pg_dump --data-only --table=campanhas > campanhas.sql
pg_dump --data-only --table=tabela_campanha > tabela_campanha.sql
pg_dump --data-only --table=posts > posts.sql
```

### 2. Configurar Novo Projeto
- Acessar: https://wjsbyahzwdupsmopygkg.supabase.co
- Criar mesmas tabelas que existem no projeto antigo
- Configurar RLS policies idênticas

### 3. Migrar Edge Functions
Copiar todas as funções de `supabase/functions/`:
```
cadastro-campanhas/
campanha-scheduler/
campanha-metricas/
disparos-brumadinho/
disparos-scheduler/
delete-post/
export-to-sheets/
```

### 4. Migrar Variáveis de Ambiente
No Dashboard do novo projeto, configurar:
```
SUPABASE_URL=https://wjsbyahzwdupsmopygkg.supabase.co
SUPABASE_ANON_KEY=[nova key]
SUPABASE_SERVICE_ROLE_KEY=[nova service key]
UAZAPI_CONFIG={"url":"...","token":"...","maxRetries":3}
AUDIO_CONFIG={"defaultFile":"audio_vazio_5s.mp3"}
```

### 5. Importar Dados
```sql
-- No novo projeto
\i campanhas.sql
\i tabela_campanha.sql
\i posts.sql
```

### 6. Atualizar Código
Execute o script PowerShell ou Bash para atualizar:
- URLs em todos os arquivos
- Keys de autenticação
- Environment variables

### 7. Testar Funcionalidades
- [ ] Criar campanha
- [ ] Adicionar leads
- [ ] Executar disparos
- [ ] Ver métricas
- [ ] Testar scheduler

## ⚠️ Pontos Críticos

1. **Keys Diferentes:** Anon key do novo projeto será diferente
2. **RLS Policies:** Precisam ser recriadas manualmente
3. **Edge Functions:** Precisam ser reimplantadas
4. **Cron Jobs:** Se usar, precisam ser reconfigurados
5. **Integrações Externas:** UAZAP, Google Sheets, etc.

## 🚀 Comandos Úteis

### Verificar conexão:
```bash
curl -X POST "https://wjsbyahzwdupsmopygkg.supabase.co/rest/v1/campanhas" \
  -H "apikey: [NOVA_ANON_KEY]" \
  -H "Authorization: Bearer [NOVA_ANON_KEY]"
```

### Deploy das Edge Functions:
```bash
supabase functions deploy cadastro-campanhas --project-ref wjsbyahzwdupsmopygkg
supabase functions deploy campanha-scheduler --project-ref wjsbyahzwdupsmopygkg
# ... etc
```

## 📞 Suporte
Se algo der errado:
1. Verificar logs das Edge Functions
2. Testar conexão com banco direto
3. Comparar configurações entre projetos
