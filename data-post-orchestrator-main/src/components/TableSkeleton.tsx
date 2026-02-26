import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton = ({ rows = 10, columns = 7 }: TableSkeletonProps) => {
  return (
    <div className="space-y-4">
      {/* Skeleton dos filtros */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Skeleton da tabela */}
      <div className="border-2 border-foreground/30 rounded-lg overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted border-b border-foreground/15">
                {Array.from({ length: columns }).map((_, index) => (
                  <TableHead key={index} className="font-semibold text-foreground text-xs uppercase tracking-wider">
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className={`border-b border-foreground/15 last:border-0 ${
                    rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/40'
                  }`}
                >
                  {Array.from({ length: columns }).map((_, colIndex) => (
                    <TableCell key={colIndex} className="whitespace-nowrap">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
