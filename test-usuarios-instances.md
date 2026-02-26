# Teste de Funcionalidade - Usuários e Instâncias UAZAPI

## 🎯 **Objetivo**

Testar a integração da gestão de instâncias UAZAPI na página de usuários.

## 📋 **Funcionalidades Implementadas**

### **1. Página de Usuários (/usuarios)**
- ✅ Lista de usuários com cards
- ✅ Botão "Instâncias" em cada usuário
- ✅ Diálogo de edição mantido
- ✅ Novo diálogo para gerenciar instâncias

### **2. Gerenciador de Instâncias**
- ✅ Lista de instâncias do usuário
- ✅ Adicionar nova instância
- ✅ Atualizar status da instância
- ✅ Remover instância
- ✅ Status em tempo real
- ✅ Interface intuitiva

## 🔄 **Fluxo de Teste**

### **Passo 1: Acessar Página de Usuários**
```
1. Faça login como admin
2. Navegue para /usuarios
3. Verifique a lista de usuários
```

### **Passo 2: Abrir Gerenciador de Instâncias**
```
1. Encontre um usuário na lista
2. Clique no botão "Instâncias" (ícone de smartphone)
3. Diálogo deve abrir com o título "Gerenciar Instâncias UAZAPI"
```

### **Passo 3: Listar Instâncias Existentes**
```
1. Verifique se instâncias existentes aparecem
2. Confirme se o status está correto (Conectado/Desconectado)
3. Verifique informações: ID, telefone, plataforma
```

### **Passo 4: Adicionar Nova Instância**
```
1. Clique em "Adicionar Instância"
2. Insira um token UAZAPI válido
3. Clique em "Configurar Instância"
4. Aguarde a validação
5. Confirme se a instância aparece na lista
```

### **Passo 5: Atualizar Status**
```
1. Clique em "Atualizar" em uma instância
2. Aguarde o refresh
3. Verifique se o status foi atualizado
4. Confirme a data/hora da última verificação
```

### **Passo 6: Remover Instância**
```
1. Clique no botão de lixeira em uma instância
2. Confirme a remoção
3. Verifique se a instância foi removida da lista
```

## 🧪 **Casos de Teste**

### **Caso 1: Usuário Sem Instâncias**
- **Ação:** Abrir gerenciador para usuário sem instâncias
- **Esperado:** Mensagem "Nenhuma instância configurada" com botão para adicionar

### **Caso 2: Usuário Com Instâncias**
- **Ação:** Abrir gerenciador para usuário com instâncias
- **Esperado:** Lista completa com cards de cada instância

### **Caso 3: Token Inválido**
- **Ação:** Tentar adicionar instância com token inválido
- **Esperado:** Mensagem de erro "Falha ao configurar instância"

### **Caso 4: Token Válido**
- **Ação:** Adicionar instância com token válido
- **Esperado:** Sucesso e instância aparece na lista

### **Caso 5: Multi-Instâncias**
- **Ação:** Configurar múltiplas instâncias
- **Esperado:** Todas aparecem na lista com status individuais

## 🔍 **Verificações Técnicas**

### **Frontend:**
- ✅ Componentes renderizam corretamente
- ✅ Estados funcionam (loading, error, success)
- ✅ Diálogos abrem e fecham corretamente
- ✅ Botões respondem aos cliques

### **Backend:**
- ✅ API responde corretamente
- ✅ Tokens são validados com UAZAPI
- ✅ Dados são salvos com tenant_id correto
- ✅ Isolamento multi-tenant funciona

### **Banco de Dados:**
- ✅ Instâncias são salvas na tabela `uazapi_instances`
- ✅ tenant_id é preenchido corretamente
- ✅ Índices funcionam para performance

## 📊 **Métricas de Performance**

### **Carregamento:**
- Lista de usuários: < 500ms
- Abrir gerenciador: < 300ms
- Carregar instâncias: < 200ms

### **Ações:**
- Configurar instância: < 3s
- Atualizar status: < 2s
- Remover instância: < 500ms

## 🚨 **Possíveis Erros**

### **Erro 1: "Não foi possível carregar as instâncias"**
- **Causa:** Problema na API ou permissões
- **Solução:** Verificar logs da Edge Function

### **Erro 2: "Falha ao configurar instância"**
- **Causa:** Token inválido ou API UAZAPI offline
- **Solução:** Validar token e status da API

### **Erro 3: "Tenant não encontrado"**
- **Causa:** usuário sem tenant_id ou problema JWT
- **Solução:** Verificar dados do usuário

### **Erro 4: Diálogo não abre**
- **Causa:** Estado não atualizado ou componente não importado
- **Solução:** Verificar imports e estado

## 📱 **Interface Esperada**

### **Card do Usuário:**
```
[Nome do Usuário]          [Editar] [Instâncias] [Remover]
email@exemplo.com
[Administrador] [Empresa] [Ativo]
Criado em: 01/01/2024
```

### **Diálogo de Instâncias:**
```
Gerenciar Instâncias UAZAPI
Configure e gerencie as instâncias do WhatsApp para este usuário

Instâncias Configuradas (2)           [Adicionar Instância]

┌─ Instância 1 ──────────────────────┐
│ Nome: WhatsApp Business             │
│ [Conectado] ID: abc123              │
│ Telefone: 5511987654321            │
│ [Atualizar] [Remover]              │
└─────────────────────────────────────┘

┌─ Instância 2 ──────────────────────┐
│ Nome: WhatsApp Personal            │
│ [Desconectado] ID: def456          │
│ Telefone: 5511912345678            │
│ [Atualizar] [Remover]              │
└─────────────────────────────────────┘
```

## ✅ **Critérios de Sucesso**

### **Funcional:**
- ✅ Usuário consegue ver instâncias de outro usuário
- ✅ Usuário consegue adicionar instâncias
- ✅ Usuário consegue remover instâncias
- ✅ Status é atualizado corretamente

### **Técnico:**
- ✅ Sem erros no console
- ✅ API responde em tempo hábil
- ✅ Dados persistem corretamente
- ✅ Multi-tenant funciona

### **Experiência:**
- ✅ Interface intuitiva
- ✅ Feedback claro para o usuário
- ✅ Carregamento rápido
- ✅ Tratamento de erros adequado

## 🎉 **Resultado Final**

Após os testes, a funcionalidade deve estar:
- **100% funcional** para gestão de instâncias
- **Integrada** na página de usuários
- **Segura** com isolamento multi-tenant
- **Performática** com tempos de resposta adequados
- **Intuitiva** com interface amigável

**Pronta para uso em produção!** 🚀
