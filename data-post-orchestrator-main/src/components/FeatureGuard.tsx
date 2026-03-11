import { ReactNode, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";

const permissionFieldMap = {
  consultorios: "allowConsultorios",
  crm: "allowCrmAgendamentos",
  agendamentos: "allowCrmAgendamentos",
  disparos_whatsapp: "allowDisparosWhatsapp",
  disparos_limpeza: "allowDisparosLimpeza",
  disparos_clareamento: "allowDisparosClareamento",
  disparos_confirmacao: "allowDisparosConfirmacao",
  disparos_aniversario: "allowDisparosAniversario",
  disparos_campanha: "allowDisparosCampanha",
  disparos_manual: "allowDisparosManual",
  chatbot: "allowChatbot",
} as const;

export type FeatureKey = keyof typeof permissionFieldMap;

const ACCESS_DENIED_MESSAGE = "Você não tem acesso a essa funcionalidade, entre em contato conosco para saber mais sobre os planos.";

export const useFeatureAccess = (feature: FeatureKey) => {
  const { permissions } = useTenant();
  const field = permissionFieldMap[feature];
  return permissions[field];
};

interface FeatureGuardProps {
  feature: FeatureKey;
  children: ReactNode;
}

export const FeatureGuard = ({ feature, children }: FeatureGuardProps) => {
  const allowed = useFeatureAccess(feature);
  const { toast } = useToast();
  const navigate = useNavigate();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!allowed && !notifiedRef.current) {
      toast({
        title: "Acesso restrito",
        description: ACCESS_DENIED_MESSAGE,
        variant: "destructive",
      });
      navigate("/home", { replace: true });
      notifiedRef.current = true;
    }
  }, [allowed, toast, navigate]);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
};
