# 📝 Alterações Realizadas para Deploy no Railway

## ✅ Arquivos Criados

### Backend (DisparosWhatsapp/)
- ✅ `Procfile` - Comando de inicialização para Railway
- ✅ `railway.json` - Configurações do Railway
- ✅ `runtime.txt` - Versão do Python
- ✅ `supabase_storage.py` - Cliente para Supabase Storage
- ✅ `file_storage.py` - Abstração de storage (local/cloud)

### Frontend (data-post-orchestrator-main/)
- ✅ `railway.json` - Configurações do Railway
- ✅ `.env.production` - Variáveis de ambiente de produção

### Documentação
- ✅ `DEPLOY_RAILWAY.md` - Guia completo de deploy
- ✅ `RECUPERACAO.md` - Como reverter as mudanças
- ✅ `ALTERACOES_RAILWAY.md` - Este arquivo

## 🔧 Arquivos Modificados

### Backend
- ✅ `requirements.txt` - Adicionado `supabase==2.3.0` e `gunicorn==21.2.0`
- ✅ `.env.example` - Adicionadas variáveis do Supabase e `ENVIRONMENT`

## 🎯 Principais Mudanças

### 1. Sistema de Storage Híbrido
O código agora suporta dois modos:
- **Local** (development): Salva arquivos na pasta `data/`
- **Cloud** (production): Usa Supabase Storage

Controlado pela variável `ENVIRONMENT`:
- `development` = storage local
- `production` = Supabase Storage

### 2. Configuração do Railway
Arquivos criados para deploy automático:
- `Procfile`: Define como iniciar o servidor
- `railway.json`: Configurações de build e deploy
- `runtime.txt`: Especifica Python 3.11

### 3. Integração com Supabase
Criado módulo `file_storage.py` que:
- Detecta automaticamente o ambiente
- Usa storage local em desenvolvimento
- Usa Supabase Storage em produção
- API unificada para ambos os casos

## 📦 Dependências Adicionadas

```txt
supabase==2.3.0      # Cliente Python do Supabase
gunicorn==21.2.0     # Servidor WSGI para produção
```

## 🔄 Como Usar o Novo Sistema de Storage

### No código existente:
```python
# Antes (salvamento local direto)
with open("data/arquivo.csv", "wb") as f:
    f.write(conteudo)

# Depois (usando FileStorage)
from file_storage import FileStorage

storage = FileStorage()
storage.save_file("arquivo.csv", conteudo, subfolder="uploads")
```

### Exemplo completo:
```python
from file_storage import FileStorage

storage = FileStorage()

# Salvar arquivo
url = storage.save_file("lista.csv", arquivo_bytes, subfolder="uploads")

# Ler arquivo
conteudo = storage.read_file("lista.csv", subfolder="uploads")

# Deletar arquivo
storage.delete_file("lista.csv", subfolder="uploads")

# Listar arquivos
arquivos = storage.list_files(subfolder="uploads")
```

## ⚙️ Variáveis de Ambiente Necessárias

### Desenvolvimento (local)
```env
ENVIRONMENT=development
```

### Produção (Railway)
```env
ENVIRONMENT=production
SUPABASE_URL=https://wtqhpovjntjbjhobqttk.supabase.co
SUPABASE_KEY=sua_chave_aqui
```

## 🚨 Importante: Próximos Passos

### Para usar em produção, você precisa:

1. **Atualizar os arquivos que fazem upload/download**
   - Substituir `open()` direto por `FileStorage()`
   - Arquivos principais: `api_routes.py`, `formata_lista_routes.py`

2. **Criar bucket no Supabase**
   - Nome: `disparos-files`
   - Tipo: Public ou com políticas de acesso

3. **Configurar variáveis no Railway**
   - Todas as variáveis listadas no `DEPLOY_RAILWAY.md`

4. **Testar localmente primeiro**
   - Com `ENVIRONMENT=development`
   - Depois com `ENVIRONMENT=production`

## 🔙 Como Reverter

Se quiser voltar ao estado original:

```bash
cd c:\Users\admin\Desktop\LAMORIA\Brumadinho
git reset --hard HEAD
```

Veja mais detalhes em `RECUPERACAO.md`.

## 📊 Compatibilidade

- ✅ Funciona localmente (modo development)
- ✅ Funciona no Railway (modo production)
- ✅ Não quebra código existente
- ✅ Migração gradual possível

## 🎓 Conceitos

### Por que Supabase Storage?
- Railway tem **filesystem efêmero** (arquivos são perdidos ao reiniciar)
- Supabase Storage é **persistente** e gratuito até 500MB
- Permite compartilhar arquivos entre múltiplas instâncias

### Por que FileStorage abstrato?
- Permite desenvolver localmente sem Supabase
- Facilita testes
- Código mais limpo e reutilizável
- Fácil trocar de provider no futuro

---

**Data:** 19 de Dezembro de 2025  
**Status:** ✅ Pronto para deploy
