# 📊 Funil de Engajamento - CRM Kanban

## O que é?

Visualização em funil que mostra o nível de engajamento dos leads que **entraram em contato** com a clínica. Permite acompanhar a jornada do lead desde a primeira resposta até o engajamento completo.

## Como Acessar

1. Acesse **CRM → Kanban**
2. Localize a coluna **"Entrou em contato"** (primeira coluna, azul)
3. Clique no ícone de **funil** (📈) no cabeçalho da coluna
4. O funil será exibido em um modal

## Etapas do Funil

O funil possui 4 etapas principais + 1 etapa separada:

### Funil Principal (em ordem decrescente):

1. **RESPONDEU** 🔵
   - Lead que respondeu à primeira mensagem
   - Topo do funil
   - Cor: Azul

2. **INTERAGIU** 🟣
   - Lead que continuou a conversa após responder
   - Demonstrou interesse inicial
   - Cor: Roxo

3. **ENGAJOU** 🟢
   - Lead altamente interessado
   - Pronto para agendar ou já agendou
   - Cor: Verde

4. **IMPECILHO** 🔴
   - Lead que encontrou algum obstáculo
   - Pode ser preço, horário, localização, etc.
   - Cor: Vermelho

### Fora do Funil:

5. **CADÊNCIA** 🟡
   - Leads que ainda não responderam
   - Estão em processo de follow-up
   - Não fazem parte do funil principal
   - Cor: Amarelo

## Como Definir o Status de Engajamento

O status de engajamento é armazenado no campo **"Feedback"** de cada lead na coluna "Entrou em contato".

### Pelo Perfil do Lead:

1. Clique no card do lead no Kanban
2. No perfil, localize o campo **"Feedback"**
3. Digite um dos status:
   - `respondeu`
   - `interagiu`
   - `engajou`
   - `impecilho`
   - `cadencia` ou `cadência`
4. Salve as alterações

### Diretamente no Supabase:

1. Acesse o Supabase
2. Vá na tabela **`posts`**
3. Filtre por `status = 'Entrou em contato'`
4. Edite o campo **`feedback`** com um dos status acima

## Métricas Exibidas

### Estatísticas Gerais:
- **Total de Leads**: Quantidade total na coluna "Entrou em contato"
- **Taxa de Conversão**: Percentual de leads que chegaram ao "Engajou"

### Por Etapa:
- Quantidade de leads em cada etapa
- Percentual em relação ao total
- Barra visual proporcional

### Insights Automáticos:
- Taxa de resposta inicial
- Taxa de continuidade (respondeu → interagiu)
- Taxa de conversão (interagiu → engajou)
- Quantidade de impecilhos encontrados

## Exemplo de Uso

### Cenário: Clínica com 100 leads que entraram em contato

```
Total: 100 leads
├─ Respondeu: 60 leads (60%)
│  └─ Interagiu: 35 leads (35%)
│     └─ Engajou: 20 leads (20%)
│        └─ Impecilho: 5 leads (5%)
└─ Cadência: 40 leads (40%) - Fora do funil
```

**Insights:**
- ✓ 60% dos leads responderam à primeira mensagem
- ↗ 58.3% dos que responderam continuaram interagindo
- 🎯 57.1% dos que interagiram chegaram ao engajamento
- ⚠ 5 leads encontraram algum impecilho no processo

## Fluxo de Trabalho Recomendado

1. **Lead entra em contato** → Move para coluna "Entrou em contato"
2. **Primeira resposta** → Marca feedback como `respondeu`
3. **Continua conversando** → Atualiza para `interagiu`
4. **Demonstra interesse forte** → Atualiza para `engajou`
5. **Encontra problema** → Marca como `impecilho` (e anota o motivo)
6. **Não responde** → Marca como `cadencia` (para follow-up)

## Benefícios

✅ **Visualização clara** do engajamento dos leads  
✅ **Identificação rápida** de gargalos no processo  
✅ **Métricas automáticas** de conversão  
✅ **Insights acionáveis** para melhorar o atendimento  
✅ **Acompanhamento** de leads em cadência  

## Dicas

💡 **Atualize o status regularmente** para ter dados precisos  
💡 **Use "impecilho"** para identificar objeções comuns  
💡 **Leads em "cadencia"** precisam de follow-up  
💡 **Alta taxa de "respondeu"** indica boa primeira mensagem  
💡 **Baixa taxa "interagiu → engajou"** pode indicar problema no atendimento  

## Próximos Passos

Após o redeploy do Railway (alguns minutos):

1. Acesse o CRM Kanban
2. Clique no ícone de funil na coluna "Entrou em contato"
3. Configure o status de engajamento dos seus leads
4. Acompanhe as métricas e otimize seu processo!
