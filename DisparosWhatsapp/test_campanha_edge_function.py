#!/usr/bin/env python3
"""
Script para testar a Edge Function de campanha
"""

import requests
import json
import os
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

def test_edge_function():
    """Testa a Edge Function de campanha"""
    
    # URL da Edge Function
    url = "https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/campanha"
    
    # Headers (use sua chave anônima do Supabase)
    headers = {
        'Authorization': f'Bearer {os.getenv("SUPABASE_ANON_KEY", "sua_chave_anon_aqui")}',
        'Content-Type': 'application/json'
    }
    
    # Dados de teste
    test_data = {
        "nome": "Teste Lead",
        "telefone": "31985671234"
    }
    
    print("🧪 Testando Edge Function de Campanha...")
    print(f"📡 URL: {url}")
    print(f"📋 Dados: {test_data}")
    print("-" * 50)
    
    try:
        # Teste POST - Adicionar lead
        print("📤 Enviando requisição POST...")
        response = requests.post(url, json=test_data, headers=headers, timeout=30)
        
        print(f"📊 Status Code: {response.status_code}")
        print(f"📄 Response Headers: {dict(response.headers)}")
        
        try:
            response_data = response.json()
            print(f"📦 Response Body: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
        except:
            print(f"📦 Response Body (raw): {response.text}")
        
        if response.status_code == 200:
            print("✅ Sucesso! Lead adicionado.")
        else:
            print("❌ Erro na requisição!")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erro de requisição: {e}")
        return False
    
    print("-" * 50)
    
    # Teste GET - Listar leads
    print("📤 Enviando requisição GET...")
    try:
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"📊 Status Code: {response.status_code}")
        
        try:
            response_data = response.json()
            print(f"📦 Leads encontrados: {len(response_data.get('leads', []))}")
            
            if response_data.get('leads'):
                print("📋 Lista de leads:")
                for i, lead in enumerate(response_data['leads'][:5], 1):  # Mostrar primeiros 5
                    print(f"  {i}. {lead.get('nome', 'N/A')} - {lead.get('telefone', 'N/A')} - {lead.get('status', 'N/A')}")
                    
                if len(response_data['leads']) > 5:
                    print(f"  ... e mais {len(response_data['leads']) - 5} leads")
            else:
                print("📋 Nenhum lead encontrado")
                
        except:
            print(f"📦 Response Body (raw): {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erro na requisição GET: {e}")
        return False
    
    return True

def check_campanha_ativa():
    """Verifica se existe campanha ativa"""
    
    url = "https://wtqhpovjntjbjhobqttk.supabase.co/rest/v1/tabela_campanha"
    headers = {
        'Authorization': f'Bearer {os.getenv("SUPABASE_ANON_KEY", "sua_chave_anon_aqui")}',
        'apikey': os.getenv("SUPABASE_ANON_KEY", "sua_chave_anon_aqui")
    }
    
    print("🔍 Verificando campanha ativa...")
    
    try:
        response = requests.get(
            f"{url}?ativo=eq.true&select=*",
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            campanhas = response.json()
            if campanhas:
                print(f"✅ Campanha ativa encontrada: {campanhas[0]['nome']}")
                print(f"📋 ID: {campanhas[0]['id']}")
                return True
            else:
                print("❌ Nenhuma campanha ativa encontrada!")
                print("💡 Você precisa ativar uma campanha primeiro.")
                return False
        else:
            print(f"❌ Erro ao buscar campanha: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def main():
    """Função principal"""
    print("🚀 Teste do Sistema de Campanhas")
    print("=" * 50)
    
    # Verificar campanha ativa
    if not check_campanha_ativa():
        print("\n⚠️ Resolva o problema da campanha ativa antes de continuar.")
        return
    
    print("\n" + "=" * 50)
    
    # Testar Edge Function
    if test_edge_function():
        print("\n✅ Teste concluído com sucesso!")
    else:
        print("\n❌ Teste falhou! Verifique os logs.")

if __name__ == "__main__":
    main()
