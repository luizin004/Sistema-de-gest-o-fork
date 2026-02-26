import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Settings } from "lucide-react";

interface ColumnConfig {
  key: string;
  label: string;
  required: boolean;
  defaultVisible: boolean;
}

interface TableColumnSelectorProps {
  columns: ColumnConfig[];
  visibleColumns: Record<string, boolean>;
  onVisibleColumnsChange: (columns: Record<string, boolean>) => void;
}

export const TableColumnSelector = ({
  columns,
  visibleColumns,
  onVisibleColumnsChange,
}: TableColumnSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Salvar estado no localStorage
  useEffect(() => {
    const saved = localStorage.getItem('table-columns-visibility');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onVisibleColumnsChange(parsed);
      } catch (error) {
        console.error('Error loading column visibility:', error);
      }
    }
  }, [onVisibleColumnsChange]);

  // Salvar no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem('table-columns-visibility', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const handleToggleColumn = (columnKey: string, checked: boolean) => {
    // Não permitir desmarcar colunas obrigatórias
    const column = columns.find(col => col.key === columnKey);
    if (column?.required && !checked) return;

    // Garantir que pelo menos uma coluna esteja visível
    const newVisibleColumns = { ...visibleColumns, [columnKey]: checked };
    const visibleCount = Object.values(newVisibleColumns).filter(Boolean).length;
    
    if (visibleCount === 0) return;

    onVisibleColumnsChange(newVisibleColumns);
  };

  const handleSelectAll = (checked: boolean) => {
    const newVisibleColumns: Record<string, boolean> = {};
    columns.forEach(col => {
      newVisibleColumns[col.key] = col.required ? true : checked;
    });
    onVisibleColumnsChange(newVisibleColumns);
  };

  const visibleCount = Object.values(visibleColumns).filter(Boolean).length;
  const totalCount = columns.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
        >
          <Settings className="h-4 w-4 mr-2" />
          Colunas ({visibleCount}/{totalCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Colunas Visíveis</h4>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAll(true)}
                className="h-7 px-2 text-xs"
              >
                Todas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAll(false)}
                className="h-7 px-2 text-xs"
              >
                Nenhuma
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {columns.map((column) => (
              <div
                key={column.key}
                className="flex items-center space-x-2 py-1"
              >
                <Checkbox
                  id={`column-${column.key}`}
                  checked={visibleColumns[column.key]}
                  onCheckedChange={(checked) =>
                    handleToggleColumn(column.key, checked as boolean)
                  }
                  disabled={column.required}
                />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <label
                    htmlFor={`column-${column.key}`}
                    className={`text-sm font-medium cursor-pointer flex-1 truncate ${
                      column.required ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                    title={column.label}
                  >
                    {column.label}
                  </label>
                  {column.required && (
                    <span className="text-xs text-muted-foreground" title="Obrigatório">
                      *
                    </span>
                  )}
                </div>
                {visibleColumns[column.key] ? (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground opacity-50" />
                )}
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t">
            <p>* Colunas obrigatórias não podem ser ocultadas</p>
            <p>A configuração é salva automaticamente</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
