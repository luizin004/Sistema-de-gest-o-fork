import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

interface Post {
  id: string;
  nome: string;
  status: string;
  data: string | null;
  horario: string | null;
  tratamento: string | null;
  telefone: string | null;
  dentista: string | null;
  data_marcada: string | null;
  created_at: string;
  feedback: string | null;
  campanha_id?: number | null;
  campanha_nome?: string | null;
}

interface TableExportProps {
  data: Post[];
  visibleColumns: Record<string, boolean>;
}

export const TableExport = ({ data, visibleColumns }: TableExportProps) => {
  const [isExporting, setIsExporting] = useState(false);

  // Configuração das colunas para exportação
  const columnConfig = [
    { key: 'nome', label: 'Nome', required: true },
    { key: 'telefone', label: 'Telefone' },
    { key: 'status', label: 'Status' },
    { key: 'dentista', label: 'Dentista' },
    { key: 'data', label: 'Data' },
    { key: 'horario', label: 'Horário' },
    { key: 'tratamento', label: 'Tratamento' },
    { key: 'campanha_nome', label: 'Campanha' },
    { key: 'created_at', label: 'Criado em' },
    { key: 'feedback', label: 'Feedback' },
    { key: 'id', label: 'ID' }
  ];

  // Filtrar colunas visíveis
  const visibleColumnConfig = columnConfig.filter(col => visibleColumns[col.key]);

  // Exportar para CSV
  const exportToCSV = () => {
    setIsExporting(true);
    
    try {
      // Criar cabeçalho
      const headers = visibleColumnConfig.map(col => col.label);
      
      // Criar linhas de dados
      const rows = data.map(post => {
        return visibleColumnConfig.map(col => {
          const value = post[col.key as keyof Post];
          if (value === null || value === undefined) return '';
          if (col.key === 'created_at' || col.key === 'data') {
            return new Date(value).toLocaleString('pt-BR');
          }
          return String(value).replace(/"/g, '""'); // Escapar aspas
        });
      });

      // Criar conteúdo CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Criar blob e download
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar para JSON
  const exportToJSON = () => {
    setIsExporting(true);
    
    try {
      // Filtrar dados apenas com colunas visíveis
      const filteredData = data.map(post => {
        const filtered: any = {};
        visibleColumnConfig.forEach(col => {
          filtered[col.key] = post[col.key as keyof Post];
        });
        return filtered;
      });

      // Criar blob e download
      const jsonContent = JSON.stringify(filteredData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting JSON:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Copiar para área de transferência
  const copyToClipboard = async () => {
    setIsExporting(true);
    
    try {
      // Criar tabela em formato de texto
      const headers = visibleColumnConfig.map(col => col.label);
      const rows = data.map(post => {
        return visibleColumnConfig.map(col => {
          const value = post[col.key as keyof Post];
          if (value === null || value === undefined) return '—';
          if (col.key === 'created_at' || col.key === 'data') {
            return new Date(value).toLocaleString('pt-BR');
          }
          return String(value);
        });
      });

      const tableText = [
        headers.join('\t'),
        ...rows.map(row => row.join('\t'))
      ].join('\n');

      await navigator.clipboard.writeText(tableText);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting || data.length === 0}
          className="h-9"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Exportar Dados</h4>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={exportToCSV}
            disabled={isExporting}
            className="w-full justify-start h-8"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            CSV (Excel)
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={exportToJSON}
            disabled={isExporting}
            className="w-full justify-start h-8"
          >
            <FileText className="h-4 w-4 mr-2" />
            JSON
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            disabled={isExporting}
            className="w-full justify-start h-8"
          >
            <Download className="h-4 w-4 mr-2" />
            Copiar para Área de Transferência
          </Button>
          
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <p>Exportará apenas as colunas visíveis</p>
            <p>{data.length} registros encontrados</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
