import re
from typing import Optional, Dict
import pandas as pd


def detectar_telefone_no_conteudo(valores: pd.Series) -> float:
    """
    Analisa o conteúdo da coluna para detectar se contém telefones.
    Retorna um score de 0 a 100.
    """
    if len(valores) == 0:
        return 0.0
    
    amostra = valores.head(20).dropna()
    if len(amostra) == 0:
        return 0.0
    
    telefones_encontrados = 0
    
    for valor in amostra:
        valor_str = str(valor).strip()
        
        # Remove espaços, parênteses, hífens, pontos
        digitos = re.sub(r'[^\d]', '', valor_str)
        
        # Telefone brasileiro tem entre 8 e 13 dígitos
        # 8-9 dígitos: número local
        # 10-11 dígitos: DDD + número
        # 12-13 dígitos: DDI + DDD + número
        if 8 <= len(digitos) <= 13:
            telefones_encontrados += 1
    
    percentual = (telefones_encontrados / len(amostra)) * 100
    return percentual


def detectar_nome_no_conteudo(valores: pd.Series) -> float:
    """
    Analisa o conteúdo da coluna para detectar se contém nomes.
    Retorna um score de 0 a 100.
    """
    if len(valores) == 0:
        return 0.0
    
    amostra = valores.head(20).dropna()
    if len(amostra) == 0:
        return 0.0
    
    nomes_encontrados = 0
    
    for valor in amostra:
        valor_str = str(valor).strip()
        
        # Nome deve ter pelo menos 2 caracteres
        if len(valor_str) < 2:
            continue
        
        # Nome geralmente tem letras e espaços
        # Não deve ter muitos números
        letras = sum(c.isalpha() or c.isspace() for c in valor_str)
        numeros = sum(c.isdigit() for c in valor_str)
        
        # Se tem mais de 70% de letras e menos de 20% de números
        if len(valor_str) > 0:
            percentual_letras = letras / len(valor_str)
            percentual_numeros = numeros / len(valor_str)
            
            if percentual_letras > 0.7 and percentual_numeros < 0.2:
                nomes_encontrados += 1
    
    percentual = (nomes_encontrados / len(amostra)) * 100
    return percentual


def detectar_indicante_no_conteudo(valores: pd.Series) -> float:
    """
    Analisa o conteúdo da coluna para detectar se contém indicantes.
    Retorna um score de 0 a 100.
    """
    if len(valores) == 0:
        return 0.0
    
    amostra = valores.head(20).dropna()
    if len(amostra) == 0:
        return 0.0
    
    indicantes_encontrados = 0
    
    # Palavras comuns em indicações
    palavras_indicacao = {
        'instagram', 'facebook', 'google', 'amigo', 'familiar', 'conhecido',
        'indicacao', 'site', 'internet', 'whatsapp', 'telefone', 'email',
        'anuncio', 'propaganda', 'outdoor', 'radio', 'tv', 'jornal',
        'revista', 'panfleto', 'cartao', 'indicou', 'recomendou'
    }
    
    for valor in amostra:
        valor_str = str(valor).strip().lower()
        
        # Remove acentos para comparação
        valor_norm = re.sub(r'[^\w\s]', '', valor_str)
        
        # Verifica se contém palavras de indicação
        if any(palavra in valor_norm for palavra in palavras_indicacao):
            indicantes_encontrados += 1
            continue
        
        # Indicante geralmente tem entre 3 e 50 caracteres
        # É composta principalmente de letras
        if 3 <= len(valor_str) <= 50:
            letras = sum(c.isalpha() or c.isspace() for c in valor_str)
            if len(valor_str) > 0 and letras / len(valor_str) > 0.7:
                indicantes_encontrados += 1
    
    percentual = (indicantes_encontrados / len(amostra)) * 100
    return percentual


def normalizar_header(col: str) -> str:
    """Normaliza o nome da coluna removendo acentos e caracteres especiais."""
    import unicodedata
    
    def remover_acentos(texto: str) -> str:
        return "".join(
            ch for ch in unicodedata.normalize("NFKD", texto) 
            if not unicodedata.combining(ch)
        )
    
    s = remover_acentos(col).strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def score_coluna_por_nome(header_norm: str, candidatos: list[str]) -> float:
    """
    Calcula score baseado no nome da coluna.
    Retorna um score de 0 a 100.
    """
    cand_norm = [normalizar_header(c) for c in candidatos]
    score = 0.0
    
    for c in cand_norm:
        if header_norm == c:
            score = max(score, 100.0)
        elif c in header_norm:
            score = max(score, 80.0)
        elif c in header_norm.split():
            score = max(score, 60.0)
    
    return score


def identificar_colunas_inteligente(df: pd.DataFrame) -> Optional[Dict[str, str]]:
    """
    Identifica colunas de nome, telefone e indicante usando análise de nome E conteúdo.
    Muito mais robusto que a versão anterior.
    """
    if df.empty or len(df.columns) == 0:
        return None
    
    cols = list(df.columns)
    
    # Candidatos para cada tipo de coluna
    candidatos_nome = ["nome", "name", "contato", "cliente", "lead", "prospect", 
                       "responsavel", "paciente", "pessoa", "usuario"]
    candidatos_tel = ["telefone", "celular", "fone", "tel", "whatsapp", "numero", 
                      "mobile", "phone", "zap", "contato", "cell"]
    candidatos_indicante = ["indicante", "indicacao", "quem indicou", "referencia", "origem",
                            "como conheceu", "fonte", "canal"]
    
    # Calcular scores para cada coluna
    scores_nome = []
    scores_tel = []
    scores_indicante = []
    
    for i, col in enumerate(cols):
        col_norm = normalizar_header(col)
        
        # Score por nome da coluna (peso 40%)
        score_nome_header = score_coluna_por_nome(col_norm, candidatos_nome) * 0.4
        score_tel_header = score_coluna_por_nome(col_norm, candidatos_tel) * 0.4
        score_indicante_header = score_coluna_por_nome(col_norm, candidatos_indicante) * 0.4
        
        # Score por conteúdo (peso 60%)
        score_nome_conteudo = detectar_nome_no_conteudo(df[col]) * 0.6
        score_tel_conteudo = detectar_telefone_no_conteudo(df[col]) * 0.6
        score_indicante_conteudo = detectar_indicante_no_conteudo(df[col]) * 0.6
        
        # Score total
        scores_nome.append((i, score_nome_header + score_nome_conteudo))
        scores_tel.append((i, score_tel_header + score_tel_conteudo))
        scores_indicante.append((i, score_indicante_header + score_indicante_conteudo))
    
    # Encontrar as melhores colunas
    scores_nome.sort(key=lambda x: x[1], reverse=True)
    scores_tel.sort(key=lambda x: x[1], reverse=True)
    scores_indicante.sort(key=lambda x: x[1], reverse=True)
    
    # Pegar as melhores com score mínimo de 30
    idx_nome = scores_nome[0][0] if scores_nome[0][1] >= 30 else None
    idx_tel = scores_tel[0][0] if scores_tel[0][1] >= 30 else None
    idx_indicante = scores_indicante[0][0] if scores_indicante[0][1] >= 30 else None
    
    # Nome e telefone são obrigatórios, indicante é opcional
    if idx_nome is None or idx_tel is None:
        return None
    
    # Se não encontrou indicante, usa a primeira coluna que não é nome nem telefone
    if idx_indicante is None:
        for i, col in enumerate(cols):
            if i != idx_nome and i != idx_tel:
                idx_indicante = i
                break
    
    if idx_indicante is None:
        return None
    
    return {
        "nome": cols[idx_nome],
        "telefone": cols[idx_tel],
        "indicante": cols[idx_indicante]
    }
