# Migração do Sistema de Limpeza para UAZAPI

## 📋 Resumo da Implementação

### ✅ Arquivos Criados/Modificados:

1. **Edge Function**: `supabase/functions/disparos-scheduler/index.ts`
   - ✅ Incluído 'limpeza' na condicional UAZAPI
   - ✅ Mantido compatibilidade com outros tipos
   - ✅ Logs específicos para debug

2. **SQLs de Migração**: 
   - `sql/verificar-estrutura-disparos-config.sql` - Verificação atual
   - `sql/migrar-disparos-config-uazapi.sql` - Migração do banco
   - `sql/testar-migracao-limpeza.sql` - Testes pós-migração

## 🚀 Passos para Deploy

### 1. Deploy da Edge Function
```bash
cd c:\brumadinho-sistema
supabase functions deploy disparos-scheduler
```

### 2. Executar SQLs no Supabase
1. Acesse: https://supabase.com/dashboard/project/wtqhpovjntjbjhobqttk/sql
2. Execute: `sql/verificar-estrutura-disparos-config.sql`
3. Execute: `sql/migrar-disparos-config-uazapi.sql`
4. Execute: `sql/testar-migracao-limpeza.sql`

## 🧪 Testes

### Teste via Frontend
1. Acesse: http://localhost:8090/disparos/limpeza/config
2. Clique em "Testar Disparo"
3. Verifique se retorna `provider: uazapi`

### Teste Manual
```bash
curl -X POST https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/disparos-scheduler \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": true, "tipo": "limpeza"}'
```

## 📊 Mudanças Implementadas

### disparos-scheduler
```typescript
// ANTES:
if (tipo === 'aniversario') {
  // UAZAPI
} else {
  // Z-API
}

// DEPOIS:
if (tipo === 'aniversario' || tipo === 'limpeza') {
  // UAZAPI para ambos
} else {
  // Z-API para clareamento/consulta
}
```

### disparos_config
- ✅ Campos UAZAPI adicionados
- ✅ Configurações atualizadas
- ✅ Backup criado

## 🔍 Verificação

### Logs de Execução
```sql
SELECT * FROM disparos_automaticos_log 
WHERE tipo = 'limpeza' 
ORDER BY data_execucao DESC 
LIMIT 5;
```

### Clientes para Disparo
```sql
SELECT nome, telefone, data_limpeza
FROM disparos 
WHERE data_limpeza = CURRENT_DATE + INTERVAL '1 day'
AND ativo = true;
```

## ⚠️ Observações

- **Lint errors**: São normais em ambiente local (Deno/Supabase modules)
- **Backup**: disparos_config_backup criado automaticamente
- **Rollback**: Use o backup se necessário

## 🎯 Próximos Passos

1. ✅ Deploy da função
2. ✅ Executar SQLs
3. ✅ Testar funcionalidade
4. 🔄 Migrar clareamento/consulta (futuro)

## 📞 Suporte

Em caso de problemas:
1. Verifique logs da Edge Function
2. Execute SQLs de verificação
3. Confirme configurações no frontend
