import { ReactNode, useEffect, useMemo, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";

interface AdminGuardProps {
  children: ReactNode;
}

export const AdminGuard = ({ children }: AdminGuardProps) => {
  const { usuario, isLoading } = useTenant();
  const { toast } = useToast();
  const warnedRef = useRef(false);

  const resolvedCargo = useMemo(() => {
    if (usuario?.cargo) return usuario.cargo;
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("usuario") || "null");
        return stored?.cargo;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [usuario?.cargo]);

  const isAdmin = resolvedCargo?.toLowerCase() === "admin";
  console.log("[AdminGuard] estado", { usuario, resolvedCargo, isAdmin, isLoading });

  useEffect(() => {
    if (!isLoading && !isAdmin && !warnedRef.current) {
      toast({
        title: "Acesso restrito",
        description: "Apenas administradores podem acessar esta funcionalidade.",
        variant: "destructive",
      });
      warnedRef.current = true;
    }
  }, [isAdmin, isLoading, toast]);

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};
