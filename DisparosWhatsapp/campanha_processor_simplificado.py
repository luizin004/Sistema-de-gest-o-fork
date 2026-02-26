#!/usr/bin/env python3
"""
Processador Simplificado de Campanhas WhatsApp
Este script trabalha apenas com a tabela 'tabela_campanha'
"""

import os
import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Optional
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('campanha_processor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class CampanhaProcessor:
    def __init__(self):
        load_dotenv()
        
        # Configuração Supabase
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Configuração UAZAPI
        self.uazapi_base_url = os.getenv('UAZAPI_BASE_URL', 'https://oralaligner.uazapi.com')
        self.uazapi_instance_token = os.getenv('UAZAPI_INSTANCE_TOKEN')
        self.uazapi_admin_token = os.getenv('UAZAPI_ADMIN_TOKEN')
        
        # Configurações de envio
        self.delay_entre_envios = int(os.getenv('DELAY_ENTRE_ENVIOS', '5'))  # segundos
        self.max_tentativas = int(os.getenv('MAX_TENTATIVAS', '3'))
        self.timeout_request = int(os.getenv('TIMEOUT_REQUEST', '30'))

    async def get_campanha_ativa(self) -> Optional[Dict]:
        """Busca a campanha ativa no banco"""
        try:
            response = self.supabase.table('tabela_campanha').select('*').eq('ativo', True).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Erro ao buscar campanha ativa: {e}")
            return None

    def limpar_telefone(self, telefone: str) -> str:
        """Limpa e formata número de telefone"""
        # Remove todos os caracteres não numéricos
        telefone_limpo = ''.join(filter(str.isdigit, telefone))
        
        # Remove 55 se já tiver no início
        if telefone_limpo.startswith('55'):
            telefone_limpo = telefone_limpo[2:]
        
        # Adiciona 55 (Brasil)
        return f"55{telefone_limpo}"

    async def enviar_mensagem_uazapi(self, telefone: str, mensagem: str) -> bool:
        """Envia mensagem via UAZAPI"""
        try:
            if not self.uazapi_base_url or not self.uazapi_instance_token:
                raise ValueError("Configuração UAZAPI incompleta")

            url = f"{self.uazapi_base_url}/message/text"
            
            payload = {
                "number": telefone,
                "text": mensagem
            }
            
            headers = {
                'Authorization': f'Bearer {self.uazapi_instance_token}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Enviando mensagem para {telefone}: {mensagem[:50]}...")
            
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=self.timeout_request
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Mensagem enviada com sucesso para {telefone}")
                return True
            else:
                error_text = response.text
                logger.error(f"❌ Erro ao enviar mensagem para {telefone}: {response.status_code} - {error_text}")
                return False
                
        except requests.RequestException as e:
            logger.error(f"❌ Erro de requisição UAZAPI: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Erro inesperado no envio: {e}")
            return False

    async def processar_lead_manual(self, nome: str, telefone: str) -> bool:
        """Processa um lead manualmente"""
        try:
            # Buscar campanha ativa
            campanha = await self.get_campanha_ativa()
            if not campanha:
                logger.error("Nenhuma campanha ativa encontrada")
                return False
            
            # Personalizar mensagem
            mensagem = campanha['mensagem_template']
                .replace('{nome}', nome.strip())
                .replace('{telefone}', self.limpar_telefone(telefone))
                .replace('{data}', datetime.now().strftime('%d/%m/%Y'))
                .replace('{hora}', datetime.now().strftime('%H:%M'))
            
            # Enviar via UAZAPI
            sucesso = await self.enviar_mensagem_uazapi(
                self.limpar_telefone(telefone),
                mensagem
            )
            
            logger.info(f"✅ Mensagem enviada para {nome} ({telefone}): {sucesso}")
            return sucesso
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar lead: {e}")
            return False

    async def run(self):
        """Executa o processador de campanha"""
        logger.info("🚀 Iniciando processador de campanha...")
        
        try:
            # Buscar campanha ativa
            campanha = await self.get_campanha_ativa()
            if not campanha:
                logger.info("ℹ️ Nenhuma campanha ativa encontrada")
                return
            
            logger.info(f"📋 Campanha ativa: {campanha['nome']}")
            
            # Como não temos tabela de leads separada, o processador apenas monitora
            logger.info("ℹ️ Sistema simplificado - apenas uma tabela de configuração")
            
            # Aqui você poderia implementar lógica para:
            # 1. Buscar leads de outra fonte
            # 2. Processar mensagens em lote
            # 3. Registrar logs na tabela_campanha
            
        except Exception as e:
            logger.error(f"❌ Erro fatal no processador: {e}")

async def main():
    """Função principal"""
    processor = CampanhaProcessor()
    await processor.run()

if __name__ == "__main__":
    asyncio.run(main())
