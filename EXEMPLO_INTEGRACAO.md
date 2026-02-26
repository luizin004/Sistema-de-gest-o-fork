# 🔧 Exemplo de Integração do FileStorage

## 📝 Como Atualizar os Arquivos Existentes

### Exemplo 1: Upload de Arquivo CSV

**Antes (api_routes.py):**
```python
@app.post("/upload")
async def upload_file(file: UploadFile):
    content = await file.read()
    
    # Salvamento local direto
    file_path = f"data/uploads/{file.filename}"
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {"filename": file.filename, "path": file_path}
```

**Depois (com FileStorage):**
```python
from file_storage import FileStorage

storage = FileStorage()

@app.post("/upload")
async def upload_file(file: UploadFile):
    content = await file.read()
    
    # Funciona local E no Railway
    file_url = storage.save_file(file.filename, content, subfolder="uploads")
    
    return {"filename": file.filename, "url": file_url}
```

### Exemplo 2: Download de Arquivo

**Antes:**
```python
@app.get("/download/{filename}")
async def download_file(filename: str):
    file_path = f"data/results/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    
    return FileResponse(file_path)
```

**Depois:**
```python
from file_storage import FileStorage
from fastapi.responses import Response

storage = FileStorage()

@app.get("/download/{filename}")
async def download_file(filename: str):
    content = storage.read_file(filename, subfolder="results")
    
    if not content:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    
    return Response(content=content, media_type="application/octet-stream")
```

### Exemplo 3: Processar Arquivo Excel

**Antes:**
```python
def processar_excel(filename: str):
    file_path = f"data/uploads/{filename}"
    df = pd.read_excel(file_path)
    # processar...
    return df
```

**Depois:**
```python
from file_storage import FileStorage
import io

storage = FileStorage()

def processar_excel(filename: str):
    content = storage.read_file(filename, subfolder="uploads")
    
    if not content:
        raise ValueError("Arquivo não encontrado")
    
    # Pandas pode ler de bytes
    df = pd.read_excel(io.BytesIO(content))
    # processar...
    return df
```

### Exemplo 4: Salvar Resultado Processado

**Antes:**
```python
def salvar_resultado(df: pd.DataFrame, filename: str):
    output_path = f"data/results/{filename}"
    df.to_csv(output_path, index=False)
    return output_path
```

**Depois:**
```python
from file_storage import FileStorage
import io

storage = FileStorage()

def salvar_resultado(df: pd.DataFrame, filename: str):
    # Converter DataFrame para bytes
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    content = buffer.getvalue()
    
    # Salvar usando FileStorage
    file_url = storage.save_file(filename, content, subfolder="results")
    return file_url
```

## 🎯 Arquivos que Precisam ser Atualizados

### Alta Prioridade (Upload/Download)
1. ✅ `api_routes.py` - Rotas de upload/download de arquivos
2. ✅ `formata_lista_routes.py` - Upload de listas para formatação
3. ✅ `csv_utils.py` - Leitura/escrita de CSV

### Média Prioridade (Processamento)
4. ⚠️ `job_runner.py` - Se salva arquivos de log/resultado
5. ⚠️ `main.py` - Se manipula arquivos

### Baixa Prioridade (Opcional)
6. ⚪ `log_utils.py` - Logs podem continuar locais
7. ⚪ `config_loader.py` - Config pode continuar local

## 🧪 Testando Localmente

### 1. Testar modo development (local)
```bash
# No .env
ENVIRONMENT=development

# Rodar servidor
python -m uvicorn web_server:app --reload

# Fazer upload de um arquivo
# Verificar se salvou em data/uploads/
```

### 2. Testar modo production (Supabase)
```bash
# No .env
ENVIRONMENT=production
SUPABASE_URL=https://wtqhpovjntjbjhobqttk.supabase.co
SUPABASE_KEY=sua_chave_aqui

# Rodar servidor
python -m uvicorn web_server:app --reload

# Fazer upload de um arquivo
# Verificar se apareceu no Supabase Storage
```

## 📋 Checklist de Migração

- [ ] Instalar dependências: `pip install supabase==2.3.0`
- [ ] Criar bucket `disparos-files` no Supabase
- [ ] Configurar políticas de acesso no Supabase
- [ ] Atualizar `api_routes.py` para usar FileStorage
- [ ] Atualizar `formata_lista_routes.py` para usar FileStorage
- [ ] Atualizar `csv_utils.py` para usar FileStorage
- [ ] Testar localmente (ENVIRONMENT=development)
- [ ] Testar com Supabase (ENVIRONMENT=production)
- [ ] Fazer deploy no Railway
- [ ] Configurar variáveis de ambiente no Railway
- [ ] Testar upload/download em produção

## 💡 Dicas

### 1. Migração Gradual
Você pode migrar um arquivo por vez. O FileStorage funciona independentemente.

### 2. Manter Compatibilidade
Se quiser manter código antigo funcionando:
```python
# Código antigo
if os.getenv("ENVIRONMENT") == "development":
    # Usar arquivos locais
    with open(file_path, "wb") as f:
        f.write(content)
else:
    # Usar FileStorage
    storage.save_file(filename, content)
```

### 3. Debug
Para ver onde os arquivos estão sendo salvos:
```python
storage = FileStorage()
print(f"Usando Supabase: {storage.use_supabase}")
print(f"Caminho: {storage.get_file_path('teste.csv')}")
```

## 🚀 Pronto para Deploy?

Quando tiver:
- ✅ Todos os arquivos atualizados
- ✅ Testado localmente
- ✅ Testado com Supabase
- ✅ Bucket criado no Supabase

Siga o guia em `DEPLOY_RAILWAY.md` para fazer o deploy!

---

**Dúvidas?** Consulte `ALTERACOES_RAILWAY.md` para detalhes técnicos.
