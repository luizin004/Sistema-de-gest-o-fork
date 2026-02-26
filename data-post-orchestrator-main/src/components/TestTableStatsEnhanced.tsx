/**
 * Componente de teste para TableStatsEnhanced
 * Use este componente para testar o novo TableStats sem afetar o original
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TableStatsEnhanced } from "./TableStatsEnhanced";

// Dados de teste (simulando posts)
const testData = [
  {
    id: "1",
    nome: "João Silva",
    status: "interessado",
    data: "2026-02-19",
    horario: "14:00",
    tratamento: "Clareamento",
    telefone: "11999999999",
    dentista: "Dr. Silva",
    data_marcada: "2026-02-20",
    created_at: "2026-02-19T10:00:00Z",
    feedback: null,
    campanha_id: 1,
    campanha_nome: "Campanha Fevereiro"
  },
  {
    id: "2", 
    nome: "Maria Santos",
    status: "respondeu",
    data: "2026-02-18",
    horario: "10:00",
    tratamento: "Limpeza",
    telefone: "11888888888",
    dentista: "Dra. Santos",
    data_marcada: "2026-02-19",
    created_at: "2026-02-18T15:00:00Z",
    feedback: "Ótimo atendimento",
    campanha_id: 2,
    campanha_nome: "Campanha Janeiro"
  }
];

export const TestTableStatsEnhanced = () => {
  const [useCompleteStats, setUseCompleteStats] = useState(false);
  const [showComponent, setShowComponent] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">🧪 Teste: TableStatsEnhanced</h1>
        
        <div className="bg-muted/50 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Controles de Teste</h2>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={useCompleteStats}
                onCheckedChange={setUseCompleteStats}
              />
              <span className="text-sm font-medium">
                {useCompleteStats ? 'Estatísticas Completas' : 'Estatísticas Atuais'}
              </span>
            </div>
            
            <Badge variant={useCompleteStats ? "default" : "secondary"}>
              {useCompleteStats ? "Incluindo Arquivados" : "Apenas Ativos"}
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => setShowComponent(!showComponent)}
              variant={showComponent ? "destructive" : "default"}
            >
              {showComponent ? "Ocultar Componente" : "Mostrar Componente"}
            </Button>
            
            <Button
              onClick={() => setUseCompleteStats(!useCompleteStats)}
              variant="outline"
            >
              Alternar Modo
            </Button>
          </div>
        </div>

        {showComponent && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Informações do Teste:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Dados de teste: {testData.length} posts simulados</li>
                <li>• Modo atual: {useCompleteStats ? "Completo (via RPC)" : "Atual (local)"}</li>
                <li>• Componente: TableStatsEnhanced</li>
                <li>• Verifique o console para logs detalhados</li>
              </ul>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Componente em Teste:</h3>
              <TableStatsEnhanced
                data={testData}
                filteredData={testData}
                useCompleteStats={useCompleteStats}
              />
            </div>
          </div>
        )}
        
        {!showComponent && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              Clique em "Mostrar Componente" para visualizar o TableStatsEnhanced em ação
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Exportar para uso em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  // Disponibilizar para testes manuais
  console.log('🧪 TestTableStatsEnhanced disponível para desenvolvimento');
}
