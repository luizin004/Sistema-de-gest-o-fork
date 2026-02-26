# Campo Source em Agendamentos

## Overview
O campo `source` foi adicionado à tabela `agendamento` para rastrear a origem de cada agendamento.

## Estrutura do Campo
- **Nome**: `source`
- **Tipo**: `TEXT NULL`
- **Propósito**: Indicar a origem do agendamento
- **Valores possíveis**:
  - `'codefy'` - Agendamentos originados do Codefy
  - `NULL` - Agendamentos manuais ou outras fontes
  - `'manual'` - Agendamentos criados manualmente (opcional)
  - `'whatsapp'` - Agendamentos via WhatsApp (opcional)
  - `'telefone'` - Agendamentos via telefone (opcional)

## Migration SQL

### Adicionar o campo ao banco de dados:
```sql
ALTER TABLE agendamento 
ADD COLUMN source TEXT NULL;

CREATE INDEX idx_agendamento_source ON agendamento(source);
```

## Uso na Aplicação

### Interface TypeScript
```typescript
interface Agendamento {
  id: string;
  nome: string;
  horario: string | null;
  telefone: string | null;
  dentista: string | null;
  data: string | null;
  data_marcada: string | null;
  presenca: string | null;
  confirmado: boolean | null;
  source: string | null; // NOVO CAMPO
  created_at: string;
}

interface AgendamentoInput {
  nome: string;
  horario?: string | null;
  telefone?: string | null;
  dentista?: string | null;
  data?: string | null;
  data_marcada?: string | null;
  source?: string | null; // NOVO CAMPO
}
```

### Exemplos de Uso

#### Criar agendamento do Codefy:
```javascript
const agendamentoCodefy = {
  nome: 'João Silva',
  telefone: '11999999999',
  dentista: 'Dr. Pedro',
  data_marcada: '2024-01-15T14:30:00Z',
  source: 'codefy'
};

await upsertAgendamento(agendamentoCodefy);
```

#### Criar agendamento manual:
```javascript
const agendamentoManual = {
  nome: 'Maria Santos',
  telefone: '11888888888',
  dentista: 'Dra. Ana',
  data_marcada: '2024-01-15T15:00:00Z',
  source: null // ou omitir o campo
};

await upsertAgendamento(agendamentoManual);
```

#### Atualizar source de um agendamento existente:
```javascript
// Marcar como Codefy
await updateSource(agendamentoId, 'codefy');

// Remover marcação Codefy
await updateSource(agendamentoId, null);
```

## Consultas SQL Úteis

### Buscar apenas agendamentos do Codefy:
```sql
SELECT * FROM agendamento WHERE source = 'codefy';
```

### Buscar agendamentos manuais:
```sql
SELECT * FROM agendamento WHERE source IS NULL;
```

### Contar agendamentos por origem:
```sql
SELECT 
  source,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM agendamento), 2) as percentage
FROM agendamento 
GROUP BY source;
```

## Implementação no Frontend

### Componente de Checkbox:
```typescript
const CheckboxCodefy = ({ agendamento, onUpdate }) => {
  const isCodefy = agendamento.source === 'codefy';
  
  return (
    <div onClick={() => onUpdate(agendamento.id, isCodefy ? null : 'codefy')}>
      <div className={`w-5 h-5 border-2 rounded ${
        isCodefy ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
      }`}>
        {isCodefy && <Check className="h-4 w-4 text-white" />}
      </div>
      <span>Codefy</span>
    </div>
  );
};
```

### Filtro:
```typescript
const filteredAgendamentos = agendamentos.filter(agg => 
  showCodefyOnly ? agg.source === 'codefy' : true
);
```

## Deploy da Função Supabase

A função `update_agendamento_source` deve ser implantada no Supabase Edge Functions para permitir atualizações do campo `source` via API.

### Comandos de Deploy:
```bash
# Deploy da função
supabase functions deploy update_agendamento_source

# Verificar logs
supabase functions serve update_agendamento_source
```

## Considerações

1. **Performance**: O índice `idx_agendamento_source` melhora consultas filtrando por source
2. **Backward Compatibility**: O campo é NULL por padrão, mantendo compatibilidade
3. **Data Integrity**: Considerar adicionar CHECK constraint para valores válidos
4. **Audit Trail**: O campo `updated_at` é atualizado automaticamente em modificações

## Testes

### Testes Unitários:
```typescript
describe('Agendamento Source', () => {
  test('deve identificar agendamento do Codefy', () => {
    const agendamento = { source: 'codefy', nome: 'Teste' };
    expect(isCodefyAgendamento(agendamento)).toBe(true);
  });

  test('deve identificar agendamento manual', () => {
    const agendamento = { source: null, nome: 'Teste' };
    expect(isCodefyAgendamento(agendamento)).toBe(false);
  });
});
```

### Testes de API:
```bash
# Testar atualização de source
curl -X PATCH "https://your-project.supabase.co/functions/v1/agendamento/uuid" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"source": "codefy"}'
```

## Futuras Melhorias

1. **Enum Types**: Usar tipo ENUM no banco para valores restritos
2. **Webhook**: Notificar sistemas externos sobre mudanças de source
3. **Analytics**: Dashboard com estatísticas de origem de agendamentos
4. **Integração**: Conectar com APIs externas para preencher source automaticamente
