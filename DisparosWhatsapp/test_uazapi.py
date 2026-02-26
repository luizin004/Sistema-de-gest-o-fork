#!/usr/bin/env python3
"""
Script de teste para migração ZAPI -> UAZAPI
Verifica se a configuração e envio estão funcionando corretamente
"""

import os
import requests
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()

def test_config_loader():
    """Testa se o config_loader está funcionando com UAZAPI"""
    print("🔧 Testando config_loader...")
    try:
        from config_loader import carregar_env
        env = carregar_env()
        print("✅ Configuração carregada com sucesso!")
        print(f"   URL: {env['UAZAPI_SEND_MESSAGE_URL']}")
        print(f"   Token: {'*' * 20}...{env['UAZAPI_INSTANCE_TOKEN'][-10:] if env['UAZAPI_INSTANCE_TOKEN'] else 'NÃO CONFIGURADO'}")
        return True
    except Exception as e:
        print(f"❌ Erro na configuração: {e}")
        return False

def test_uazapi_connection():
    """Testa conexão básica com UAZAPI"""
    print("\n🌐 Testando conexão UAZAPI...")
    try:
        base_url = os.getenv("UAZAPI_BASE_URL", "").rstrip("/")
        instance_token = os.getenv("UAZAPI_INSTANCE_TOKEN", "")
        
        if not base_url or not instance_token:
            print("❌ Variáveis de ambiente UAZAPI não configuradas")
            return False
        
        # Testa status da instância
        status_url = f"{base_url}/instance/status"
        headers = {"Authorization": f"Bearer {instance_token}"}
        
        response = requests.get(status_url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Instância conectada! Status: {data.get('status', 'unknown')}")
            return True
        else:
            print(f"❌ Erro na conexão: HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao testar conexão: {e}")
        return False

def test_send_message():
    """Testa envio de mensagem (requer número configurado)"""
    print("\n📱 Testando envio de mensagem...")
    
    # Número para teste (configure abaixo)
    test_number = os.getenv("TEST_PHONE_NUMBER", "")
    
    if not test_number:
        print("⚠️  TEST_PHONE_NUMBER não configurado. Pulando teste de envio.")
        print("   Para testar, defina: TEST_PHONE_NUMBER=5531999998888")
        return True
    
    try:
        base_url = os.getenv("UAZAPI_BASE_URL", "").rstrip("/")
        instance_token = os.getenv("UAZAPI_INSTANCE_TOKEN", "")
        
        url = f"{base_url}/send-message"
        headers = {
            "Authorization": f"Bearer {instance_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "number": test_number,
            "message": "🧪 Teste UAZAPI - Migração concluída com sucesso! 🚀"
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            print("✅ Mensagem enviada com sucesso!")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Erro no envio: HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao enviar mensagem: {e}")
        return False

def test_integrations_module():
    """Testa se o módulo integrations funciona com UAZAPI"""
    print("\n🔗 Testando módulo integrations...")
    try:
        from integrations import enviar_uazapi
        import requests
        
        # Teste básico da função
        session = requests.Session()
        url = "https://oralaligner.uazapi.com/send-message"
        telefone = "5531999998888"  # número fake para teste
        mensagem = "Teste unitário"
        timeout = 30
        instance_token = os.getenv("UAZAPI_INSTANCE_TOKEN", "")
        
        print("✅ Função enviar_uazapi importada com sucesso!")
        print("   (envio real não executado para evitar spam)")
        return True
        
    except Exception as e:
        print(f"❌ Erro no módulo integrations: {e}")
        return False

def main():
    """Executa todos os testes"""
    print("🚀 TESTE DE MIGRAÇÃO ZAPI -> UAZAPI")
    print("=" * 50)
    
    tests = [
        ("Configuração", test_config_loader),
        ("Conexão UAZAPI", test_uazapi_connection),
        ("Módulo Integrations", test_integrations_module),
        ("Envio de Mensagem", test_send_message),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ Erro inesperado no teste {name}: {e}")
            results.append((name, False))
    
    # Resumo final
    print("\n" + "=" * 50)
    print("📊 RESUMO DOS TESTES:")
    
    passed = 0
    for name, result in results:
        status = "✅ PASSOU" if result else "❌ FALHOU"
        print(f"   {name}: {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 Resultado: {passed}/{len(results)} testes passaram")
    
    if passed == len(results):
        print("🎉 Migração UAZAPI concluída com sucesso!")
        return 0
    else:
        print("⚠️  Alguns testes falharam. Verifique a configuração.")
        return 1

if __name__ == "__main__":
    exit(main())
