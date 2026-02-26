# Como Usar - Gestão de Instâncias UAZAPI na Página de Usuários

## 🎯 **Acesso Rápido**

### **1. Acessar a Página de Usuários**
```
1. Faça login como administrador
2. No menu, clique em "Usuários" ou acesse: /usuarios
3. Você verá a lista de todos os usuários do sistema
```

### **2. Gerenciar Instâncias de um Usuário**
```
1. Encontre o usuário desejado na lista
2. Clique no botão "Instâncias" (ícone de smartphone 📱)
3. O diálogo de gerenciamento abrirá
```

---

## 📱 **Gerenciador de Instâncias**

### **Tela Principal**
```
┌─ Gerenciar Instâncias UAZAPI ─────────────────────┐
│ Configure e gerencie as instâncias do WhatsApp     │
│ para este usuário                                  │
│                                                    │
│ Instâncias Configuradas (2)    [Adicionar Instância] │
└────────────────────────────────────────────────────┘
```

### **Lista de Instâncias**
Cada instância aparece como um card com:
- ✅ **Nome** da instância
- 🟢 **Status** (Conectado/Desconectado)
- 📱 **ID** da instância
- 📞 **Telefone** associado
- 🔄 **Ações**: Atualizar e Remover

---

## ➕ **Adicionar Nova Instância**

### **Passo a Passo:**
```
1. Clique em "Adicionar Instância"
2. Cole o token UAZAPI no campo
3. Clique em "Configurar Instância"
4. Aguarde a validação automática
5. Pronto! Instância configurada
```

### **Onde Encontrar o Token UAZAPI:**
```
1. Acesse seu painel UAZAPI
2. Vá em "Instâncias" ou "Instances"
3. Clique na instância desejada
4. Copie o "Token" ou "API Token"
```

---

## 🔄 **Atualizar Status da Instância**

### **Quando Atualizar:**
- ⚠️ Status aparece como "Desconectado"
- ⚠️ Mensagens não estão sendo enviadas
- ⚠️ Quer verificar se está tudo ok

### **Como Atualizar:**
```
1. No card da instância, clique em "Atualizar"
2. Aguarde alguns segundos
3. O status será atualizado automaticamente
```

---

## 🗑️ **Remover Instância**

### **Cuidado ao Remover:**
- ⚠️ Todas as mensagens pararão de ser enviadas
- ⚠️ Configuração será perdida
- ⚠️ Precisará configurar novamente

### **Como Remover:**
```
1. Clique no ícone da lixeira 🗑️
2. Confirme a remoção
3. Instância será removida imediatamente
```

---

## 📊 **Status das Instâncias**

### **🟢 Conectado**
- ✅ Instância ativa e funcionando
- ✅ Podem enviar mensagens
- ✅ Recebendo webhooks

### **🔴 Desconectado**
- ❌ Instância offline
- ❌ Não envia mensagens
- ❌ Precisa reconectar

---

## 🎯 **Dicas e Boas Práticas**

### **✅ Boas Práticas:**
1. **Tokens Seguros:** Mantenha seus tokens seguros
2. **Uma por Vez:** Configure uma instância de cada vez
3. **Teste Após Configurar:** Envie uma mensagem de teste
4. **Monitore Status:** Atualize regularmente

### **⚠️ Cuidados:**
1. **Não Compartilhe Tokens:** Cada instância tem seu token
2. **Verifique Conexão:** Mantenha instâncias conectadas
3. **Backup:** Salve tokens em local seguro
4. **Teste:** Valide antes de usar em produção

---

## 🔧 **Solução de Problemas**

### **Problema: "Falha ao configurar instância"**
```
Causa: Token inválido ou expirado
Solução: 
1. Verifique o token no painel UAZAPI
2. Copie novamente sem espaços extras
3. Tente configurar novamente
```

### **Problema: "Não foi possível carregar instâncias"**
```
Causa: Problema de conexão ou permissão
Solução:
1. Verifique sua conexão
2. Faça login novamente
3. Contate o suporte
```

### **Problema: "Instância desconectada"**
```
Causa: WhatsApp desconectado ou problema UAZAPI
Solução:
1. Clique em "Atualizar"
2. Verifique no painel UAZAPI
3. Reconecte se necessário
```

---

## 📱 **Exemplo Prático**

### **Cenário 1: Configurar Primeira Instância**
```
Usuário: João da Silva
Empresa: Clínica Sorriso

1. Acessar /usuarios
2. Encontrar "João da Silva"
3. Clicar em "Instâncias"
4. Clicar em "Adicionar Instância"
5. Colar token: "abc123-def456-ghi789"
6. Clicar em "Configurar Instância"
7. Aguardar validação
8. Pronto! João já pode enviar mensagens
```

### **Cenário 2: Múltiplas Instâncias**
```
Usuário: Maria Santos
Empresa: Hospital Vida

Instâncias configuradas:
- 📱 WhatsApp Principal (Conectado)
- 📱 WhatsApp Secundário (Desconectado)

Ações:
1. Atualizar status da secundária
2. Remover se não for mais necessária
3. Configurar nova se precisar
```

---

## 🎉 **Benefícios Alcançados**

### **✅ Para o Administrador:**
- Gerencie todas as instâncias em um lugar
- Visibilidade completa do status
- Controle total sobre configurações

### **✅ Para o Usuário Final:**
- Instâncias configuradas automaticamente
- Status sempre visível
- Foco apenas em usar o sistema

### **✅ Para o Sistema:**
- Multi-tenant seguro
- Performance otimizada
- Escalabilidade garantida

---

## 📞 **Suporte**

### **Precisa de Ajuda?**
1. **Verifique este guia** primeiro
2. **Teste com tokens válidos**
3. **Monitore os logs** do sistema
4. **Contate o suporte** se necessário

### **Horário de Suporte:**
- Segunda a Sexta: 9h-18h
- E-mail: suporte@empresa.com
- Telefone: (0XX) 1234-5678

---

## 🚀 **Pronto para Usar!**

Agora você pode:
- ✅ **Gerenciar instâncias** facilmente
- ✅ **Configurar WhatsApp** em segundos
- ✅ **Monitorar status** em tempo real
- ✅ **Manter tudo organizado** por usuário

**Sistema 100% funcional e pronto para produção!** 🎯
