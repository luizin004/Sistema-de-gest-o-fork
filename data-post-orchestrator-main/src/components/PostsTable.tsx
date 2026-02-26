import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LeadFilters, useLeadFilters } from "./LeadFilters";
import { User, Phone, Calendar, Clock, Stethoscope, UserCheck } from "lucide-react";

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
}

interface PostsTableProps {
  posts: Post[];
}

const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes("entrou")) return "bg-blue-500/10 text-blue-600 border-blue-200";
  if (statusLower.includes("interessado")) return "bg-amber-500/10 text-amber-600 border-amber-200";
  if (statusLower.includes("agendou")) return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
  if (statusLower.includes("compareceu") && !statusLower.includes("não")) return "bg-green-600/10 text-green-700 border-green-200";
  if (statusLower.includes("não")) return "bg-red-500/10 text-red-600 border-red-200";
  return "bg-muted text-muted-foreground border-border";
};

export const PostsTable = ({ posts }: PostsTableProps) => {
  const { filters, setFilters, filteredPosts } = useLeadFilters(posts);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-xl bg-muted/20">
        <User className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground font-medium">Nenhum lead encontrado</p>
        <p className="text-sm text-muted-foreground/70">Os leads aparecerão aqui quando criados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <LeadFilters 
        posts={posts} 
        filters={filters} 
        onFiltersChange={setFilters} 
      />
      
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          Mostrando <span className="font-semibold text-foreground">{filteredPosts.length}</span> de {posts.length} leads
        </p>
      </div>

      <div className="border border-border/60 rounded-xl overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                <TableHead className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Nome
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Telefone
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    Dentista
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Data
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Horário
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    Tratamento
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-foreground">Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <User className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-muted-foreground font-medium">Nenhum resultado encontrado</p>
                      <p className="text-sm text-muted-foreground/70">Tente ajustar os filtros</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPosts.map((post, index) => (
                  <TableRow 
                    key={post.id} 
                    className="table-row-hover border-b border-border/40 last:border-0"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          {post.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{post.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {post.telefone ? (
                        <span className="font-mono text-sm bg-muted/50 px-2 py-1 rounded-md">{post.telefone}</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`badge-status border ${getStatusColor(post.status)}`}>
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {post.dentista ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-medium">
                            {post.dentista[0]}
                          </div>
                          <span className="text-foreground/80">Dr(a). {post.dentista}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {post.data ? (
                        <span className="bg-muted/50 px-2 py-1 rounded-md text-sm">
                          {new Date(post.data).toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {post.horario ? (
                        <span className="font-mono text-sm bg-muted/50 px-2 py-1 rounded-md">{post.horario}</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {post.tratamento ? (
                        <Badge variant="secondary" className="font-normal bg-secondary/80">
                          {post.tratamento}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(post.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
