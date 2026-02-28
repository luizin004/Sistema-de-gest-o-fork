import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, UserCircle2, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AccountMenuProps {
  compact?: boolean;
}

interface StoredUser {
  nome?: string;
  email?: string;
  cargo?: string;
  tenant_id?: string;
}

export const AccountMenu = ({ compact = false }: AccountMenuProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const readUserFromStorage = () => {
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("usuario") : null;
        setUser(stored ? JSON.parse(stored) : null);
      } catch (error) {
        console.error("[AccountMenu] Erro ao ler usuário do storage", error);
        setUser(null);
      }
    };

    readUserFromStorage();
    window.addEventListener("storage", readUserFromStorage);
    return () => window.removeEventListener("storage", readUserFromStorage);
  }, []);

  const initials = useMemo(() => {
    if (!user?.nome) return "MC";
    return user.nome
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user?.nome]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("usuario");
      setUser(null);
      toast({ title: "Sessão encerrada", description: "Você saiu da plataforma." });
      navigate("/login");
    } catch (error) {
      console.error("[AccountMenu] Erro ao sair", error);
      toast({
        title: "Erro ao sair",
        description: "Não foi possível encerrar a sessão.",
        variant: "destructive",
      });
    }
  };

  const handleDetailNavigation = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    navigate("/minha-conta");
  };

  if (!user) {
    return (
      <Button
        variant="outline"
        onClick={() => navigate("/login")}
        className={cn("rounded-full", compact ? "w-full justify-center" : "")}
      >
        Entrar
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "flex items-center gap-3 transition-all duration-200",
            compact 
              ? "w-full justify-center px-2 py-2 border-0 bg-transparent shadow-none hover:bg-slate-50" 
              : "rounded-2xl border-slate-200/60 bg-white/90 text-sm font-medium shadow-md hover:shadow-lg hover:border-slate-300/80 hover:bg-white px-3 py-2.5"
          )}
        >
          <div className={`flex items-center justify-center text-primary transition-all ${compact ? "text-lg font-bold" : "h-9 w-9 rounded-full bg-gradient-to-br from-primary/10 to-primary/5"}`}>
            {initials}
          </div>
          {!compact && (
            <div className="hidden text-left sm:block">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Minha conta</p>
              <p className="text-sm font-semibold text-slate-800 line-clamp-1">{user.nome}</p>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-2">
          <p className="text-sm font-semibold text-slate-900">{user.nome}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
          {user.tenant_id && (
            <p className="mt-1 text-[11px] uppercase text-slate-400">Tenant: {user.tenant_id}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDetailNavigation} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" /> Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
