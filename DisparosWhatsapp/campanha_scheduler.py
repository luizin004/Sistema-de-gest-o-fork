#!/usr/bin/env python3
"""
Agendador Automático de Campanhas
Executa o processador de campanha em intervalos regulares
"""

import asyncio
import schedule
import time
import logging
from datetime import datetime
from campanha_processor import CampanhaProcessor

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('campanha_scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class CampanhaScheduler:
    def __init__(self):
        self.processor = CampanhaProcessor()
        self.running = False

    async def executar_processamento(self):
        """Executa o processamento de campanha"""
        try:
            logger.info("🔄 Iniciando execução agendada do processador...")
            await self.processor.run()
            logger.info("✅ Execução agendada concluída")
        except Exception as e:
            logger.error(f"❌ Erro na execução agendada: {e}")

    def iniciar_agendamento(self):
        """Inicia o agendamento de tarefas"""
        logger.info("🚀 Iniciando agendador de campanhas...")
        
        # Agendar execuções
        schedule.every(5).minutes.do(self.run_job)  # A cada 5 minutos
        schedule.every().hour.do(self.run_job)     # A cada hora
        schedule.every().day.at("09:00").do(self.run_job)  # Diário às 9h
        schedule.every().day.at("14:00").do(self.run_job)  # Diário às 14h
        schedule.every().day.at("18:00").do(self.run_job)  # Diário às 18h
        
        logger.info("📅 Agendamentos configurados:")
        logger.info("   • A cada 5 minutos")
        logger.info("   • A cada hora")
        logger.info("   • Diário às 09:00")
        logger.info("   • Diário às 14:00")
        logger.info("   • Diário às 18:00")
        
        self.running = True
        
        # Loop principal
        while self.running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Verificar a cada minuto
            except KeyboardInterrupt:
                logger.info("⏹️ Agendador interrompido pelo usuário")
                break
            except Exception as e:
                logger.error(f"❌ Erro no agendador: {e}")
                time.sleep(60)  # Esperar antes de tentar novamente

    def run_job(self):
        """Wrapper para executar job assíncrono"""
        asyncio.run(self.executar_processamento())

    def parar(self):
        """Para o agendador"""
        self.running = False
        logger.info("⏹️ Agendador parado")

def main():
    """Função principal"""
    scheduler = CampanhaScheduler()
    
    try:
        scheduler.iniciar_agendamento()
    except KeyboardInterrupt:
        logger.info("👋 Encerrando agendador...")
        scheduler.parar()

if __name__ == "__main__":
    main()
