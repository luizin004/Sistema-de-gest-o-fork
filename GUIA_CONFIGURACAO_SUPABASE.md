# 🚀 Guia Completo de Configuração - Sistema de Consultórios com Supabase

## 📋 Visão Geral

Este sistema gerencia horários de 4 consultórios odontológicos, permitindo:
- Cadastrar dentistas com nome, especialidade e cor
- Alocar dentistas em horários específicos (Segunda a Sábado, 7h às 19h)
- Visualizar escalas com identificação visual por cores
- Editar e excluir dentistas

## 🗄️ Passo 1: Configurar o Banco de Dados no Supabase

### 1.1 Acessar o Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Acesse seu projeto: **wtqhpovjntjbjhobqttk**

### 1.2 Executar o Script SQL

1. No painel do Supabase, vá em **SQL Editor** (ícone de banco de dados no menu lateral)
2. Clique em **New Query**
3. Abra o arquivo `supabase_schema.sql` deste projeto
4. Copie TODO o conteúdo do arquivo
5. Cole no editor SQL do Supabase
6. Clique em **Run** (ou pressione Ctrl+Enter)

### 1.3 Verificar as Tabelas Criadas

1. Vá em **Table Editor** no menu lateral
2. Você deve ver 3 novas tabelas:
   - ✅ **dentistas** - Cadastro de dentistas
   - ✅ **consultorios** - 4 consultórios (já populados)
   - ✅ **escala_semanal** - Horários alocados

### 1.4 Verificar os Dados Iniciais

1. Clique na tabela **consultorios**
2. Você deve ver 4 registros:
   - Consultório 1 (numero: 1)
   - Consultório 2 (numero: 2)
   - Consultório 3 (numero: 3)
   - Consultório 4 (numero: 4)

## 🔧 Passo 2: Configurar o Frontend

### 2.1 Verificar Configuração do Supabase

O arquivo `src/integrations/supabase/client.ts` já está configurado com:
```typescript
SUPABASE_URL = "https://wtqhpovjntjbjhobqttk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

✅ **Não precisa alterar nada aqui!**

### 2.2 Atualizar Types do Supabase (Opcional mas Recomendado)

Para ter TypeScript completo, você pode gerar os types automaticamente:

1. Instale a CLI do Supabase:
```bash
npm install -g supabase
```

2. Faça login:
```bash
supabase login
```

3. Gere os types:
```bash
supabase gen types typescript --project-id wtqhpovjntjbjhobqttk > src/integrations/supabase/types.ts
```

**OU** você pode usar o código sem types (vai funcionar, mas sem autocomplete completo).

## 🎯 Passo 3: Testar o Sistema

### 3.1 Iniciar o Frontend

```bash
cd data-post-orchestrator-main
npm run dev
```

### 3.2 Acessar a Página de Consultórios

1. Abra o navegador em `http://localhost:8080`
2. Clique no card **"Consultórios"** na página inicial
3. Você verá a interface de gestão de consultórios

### 3.3 Testar Funcionalidades

#### ✅ Adicionar Dentista
1. Clique em **"Adicionar Dentista"**
2. Preencha:
   - Nome: Dr. João Silva
   - Especialidade: Odontologia Geral
   - Cor: #8B5CF6 (roxo)
3. Clique em **"Adicionar Dentista"**
4. Verifique a notificação de sucesso

#### ✅ Ver Dentistas
1. Clique em **"Ver Dentistas"**
2. Você verá a lista de dentistas cadastrados
3. Cada dentista mostra sua cor identificadora

#### ✅ Alocar Horário
1. Clique no nome de um consultório para expandir
2. Clique em uma célula vazia (marcada como "Disponível")
3. Selecione um dentista da lista
4. O horário será preenchido com a cor e informações do dentista

#### ✅ Remover Horário
1. Clique em uma célula preenchida
2. Confirme a remoção
3. O horário voltará a ficar disponível

#### ✅ Editar Dentista
1. Clique em **"Ver Dentistas"**
2. Clique no ícone de edição (lápis)
3. Modifique os dados
4. Clique em **"Salvar Alterações"**

#### ✅ Excluir Dentista
1. Clique em **"Ver Dentistas"**
2. Clique no ícone de exclusão (lixeira)
3. Confirme a exclusão
4. Todos os horários do dentista serão removidos

## 🎨 Estrutura do Banco de Dados

### Tabela: dentistas
```sql
id          UUID (PK)
nome        TEXT
especialidade TEXT
cor_hex     TEXT (#RRGGBB)
ativo       BOOLEAN
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### Tabela: consultorios
```sql
id          UUID (PK)
nome        TEXT
numero      INTEGER (1, 2, 3, 4)
ativo       BOOLEAN
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### Tabela: escala_semanal
```sql
id              UUID (PK)
dentista_id     UUID (FK → dentistas)
consultorio_id  UUID (FK → consultorios)
dia_semana      INTEGER (1-6: Seg-Sáb)
horario_inicio  TIME (07:00-19:00)
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### Constraints de Integridade

✅ **unique_consultorio_horario**: Impede dois dentistas no mesmo consultório/dia/horário
✅ **unique_dentista_horario**: Impede um dentista em dois lugares ao mesmo tempo

## 📊 Views Disponíveis

O script SQL cria 3 views úteis:

### vw_escala_completa
Mostra toda a escala com informações completas dos dentistas e consultórios.

### vw_estatisticas_dentistas
Estatísticas por dentista: total de horários, consultórios, primeiro e último horário.

### vw_disponibilidade_consultorios
Mostra ocupação de cada consultório: horários ocupados, disponíveis e percentual.

## 🔍 Consultas SQL Úteis

### Ver escala de um consultório específico
```sql
SELECT * FROM vw_escala_completa 
WHERE consultorio_numero = 1 
ORDER BY dia_semana, horario_inicio;
```

### Ver todos os horários de um dentista
```sql
SELECT * FROM vw_escala_completa 
WHERE dentista_nome = 'Dr. João Silva'
ORDER BY dia_semana, horario_inicio;
```

### Ver estatísticas de todos os dentistas
```sql
SELECT * FROM vw_estatisticas_dentistas;
```

### Ver disponibilidade dos consultórios
```sql
SELECT * FROM vw_disponibilidade_consultorios;
```

## 🐛 Solução de Problemas

### Erro: "relation dentistas does not exist"
**Solução**: Execute o script SQL completo no Supabase SQL Editor.

### Erro: TypeScript - tabelas não reconhecidas
**Solução**: 
1. Execute o script SQL primeiro
2. Gere os types com `supabase gen types`
3. OU ignore os erros de TypeScript (o código funciona mesmo assim)

### Erro: "duplicate key value violates unique constraint"
**Causa**: Tentando alocar:
- Dois dentistas no mesmo horário/consultório, OU
- Um dentista em dois consultórios ao mesmo tempo

**Solução**: Escolha outro horário ou consultório.

### Dentistas não aparecem na lista
**Verificar**:
1. Abra o console do navegador (F12)
2. Veja se há erros de conexão
3. Verifique se o script SQL foi executado
4. Verifique se a tabela `dentistas` existe no Supabase

### Horários não são salvos
**Verificar**:
1. Console do navegador para erros
2. Se a tabela `escala_semanal` existe
3. Se as foreign keys estão corretas

## 📱 Funcionalidades da Interface

### Página Principal
- Header com título e botões de ação
- Botão "Ver Dentistas" - Lista todos os dentistas
- Botão "Adicionar Dentista" - Cadastra novo dentista

### Cards de Consultórios
- Clique para expandir/colapsar
- Mostra quantidade de horários alocados
- Tabela de horários (Segunda a Sábado, 7h-19h)

### Células da Tabela
- **Vazia**: Mostra "Disponível" - Clique para alocar
- **Preenchida**: Mostra dentista com cor - Clique para remover
- Identificação visual por cor do dentista

### Dialogs
- **Adicionar Dentista**: Nome, especialidade, seletor de cor
- **Ver Dentistas**: Lista com botões editar/excluir
- **Editar Dentista**: Modificar dados existentes
- **Selecionar Dentista**: Escolher dentista para alocar

## 🎯 Fluxo de Trabalho Recomendado

1. **Cadastrar Dentistas**
   - Adicione todos os dentistas da clínica
   - Escolha cores distintas para cada um
   - Anote os nomes para facilitar

2. **Montar Escalas**
   - Expanda cada consultório
   - Clique nas células vazias
   - Selecione o dentista desejado
   - O sistema valida conflitos automaticamente

3. **Gerenciar Mudanças**
   - Edite dentistas quando necessário
   - Remova horários clicando nas células preenchidas
   - Exclua dentistas que saíram da clínica

## 🔐 Segurança (Opcional)

O script SQL inclui políticas RLS comentadas. Para ativar:

1. Descomente as linhas de RLS no script SQL
2. Configure autenticação no Supabase
3. As políticas permitem:
   - Leitura pública
   - Escrita apenas para usuários autenticados

## 📞 Suporte

### Verificar Logs
- **Frontend**: Console do navegador (F12)
- **Backend**: SQL Editor no Supabase

### Testar Conexão
```javascript
// No console do navegador
import { supabase } from '@/integrations/supabase/client';
const { data, error } = await supabase.from('dentistas').select('*');
console.log(data, error);
```

## ✅ Checklist de Configuração

- [ ] Conta no Supabase criada
- [ ] Projeto acessado (wtqhpovjntjbjhobqttk)
- [ ] Script SQL executado no SQL Editor
- [ ] Tabelas criadas verificadas (dentistas, consultorios, escala_semanal)
- [ ] 4 consultórios verificados na tabela consultorios
- [ ] Frontend iniciado (`npm run dev`)
- [ ] Página de consultórios acessada
- [ ] Dentista de teste cadastrado
- [ ] Horário de teste alocado
- [ ] Sistema funcionando ✅

---

**Sistema pronto para uso!** 🎉

Desenvolvido para OralDents Brumadinho - 2024
