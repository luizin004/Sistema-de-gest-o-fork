# 🤖 Detector Inteligente de Colunas

## O que é?

Sistema de IA que identifica automaticamente as colunas de **nome**, **telefone** e **cidade** em qualquer CSV, mesmo que as colunas tenham nomes diferentes ou estejam em ordem diferente.

## Como Funciona?

O detector usa **duas estratégias combinadas**:

### 1. Análise do Nome da Coluna (40% do score)
Procura por palavras-chave nos nomes das colunas:
- **Nome**: nome, name, contato, cliente, paciente, pessoa, etc.
- **Telefone**: telefone, celular, fone, tel, whatsapp, zap, etc.
- **Cidade**: cidade, city, municipio, localidade, etc.

### 2. Análise do Conteúdo (60% do score) ⭐ NOVIDADE
Examina os dados dentro das colunas para identificar padrões:

#### Detecção de Telefone:
- Conta quantos dígitos tem (8-13 = telefone brasileiro)
- Remove espaços, parênteses, hífens automaticamente
- Aceita formatos: `31999999999`, `(31) 99999-9999`, `55 31 9 9999-9999`

#### Detecção de Nome:
- Verifica se tem mais de 70% de letras
- Verifica se tem menos de 20% de números
- Nomes geralmente têm espaços entre palavras

#### Detecção de Cidade:
- Compara com lista de cidades conhecidas de MG
- Verifica se tem entre 3-30 caracteres
- Verifica se é composto principalmente de letras

## Exemplos de CSV que Funcionam

### Exemplo 1: Nomes em Inglês
```csv
Patient Name,Cell Phone,Location
João Silva,31999999999,Belo Horizonte
Maria Santos,31988888888,Contagem
```
✅ **Funciona!** Detecta "Patient Name" como nome, "Cell Phone" como telefone

### Exemplo 2: Colunas Sem Nome Claro
```csv
Coluna1,Coluna2,Coluna3
João Silva,31999999999,Belo Horizonte
Maria Santos,31988888888,Contagem
```
✅ **Funciona!** Analisa o conteúdo e identifica automaticamente

### Exemplo 3: Ordem Diferente
```csv
Cidade,Contato,Cliente
Belo Horizonte,31999999999,João Silva
Contagem,31988888888,Maria Santos
```
✅ **Funciona!** A ordem não importa

### Exemplo 4: Nomes Criativos
```csv
Quem é?,Zap,Onde mora?
João Silva,31999999999,Belo Horizonte
Maria Santos,31988888888,Contagem
```
✅ **Funciona!** Mesmo com nomes incomuns, detecta pelo conteúdo

## Vantagens para a Secretaria

1. **Não precisa renomear colunas** - O sistema entende automaticamente
2. **Não precisa formatar o CSV** - Aceita qualquer formato comum
3. **Não precisa ordenar colunas** - A ordem não importa
4. **Funciona com Excel e CSV** - Suporta .xlsx, .xls, .csv
5. **Tolerante a erros** - Se uma estratégia falhar, tenta a outra

## Requisitos Mínimos

O CSV/Excel precisa ter:
- ✅ Uma coluna com **nomes de pessoas**
- ✅ Uma coluna com **telefones** (qualquer formato)
- ✅ Uma coluna com **cidades** (se não tiver, usa qualquer outra coluna)

## Score Mínimo

Para uma coluna ser identificada, precisa ter **score ≥ 30**:
- Score 100 = Certeza absoluta
- Score 60-99 = Alta confiança
- Score 30-59 = Confiança moderada
- Score < 30 = Rejeitado

## Fallback Inteligente

Se o detector inteligente falhar, o sistema automaticamente tenta o método antigo (apenas por nome de coluna), garantindo máxima compatibilidade.

## Cidades Conhecidas em MG

O sistema reconhece automaticamente estas cidades:
- Belo Horizonte, Contagem, Uberlândia, Juiz de Fora
- Betim, Montes Claros, Ribeirão das Neves, Uberaba
- Governador Valadares, Ipatinga, Sete Lagoas, Divinópolis
- Itabira, Brumadinho, Ouro Preto, Mariana
- E mais 20+ cidades...

## Testando

Após o redeploy do Railway (alguns minutos):

1. Acesse o sistema
2. Vá em **Formatar Listas**
3. Faça upload de qualquer CSV com nome e telefone
4. O sistema detectará automaticamente as colunas
5. Você verá quais colunas foram identificadas no preview

## Tecnologia

- **Pandas** para análise de dados
- **Regex** para detecção de padrões
- **Score ponderado** (40% nome + 60% conteúdo)
- **Fallback automático** para compatibilidade
