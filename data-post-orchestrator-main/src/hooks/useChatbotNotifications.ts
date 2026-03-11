import { useEffect, useRef } from "react";
import { supabaseUntyped } from "@/integrations/supabase/client";
import { getTenantId } from "@/utils/tenantUtils";
import { toast } from "sonner";

/**
 * Listens for realtime chatbot notifications (when bot pauses for attention or scheduling interest).
 * Shows toast notifications to the CRM user.
 */
export function useChatbotNotifications() {
  const tenantId = getTenantId();
  const channelRef = useRef<ReturnType<typeof supabaseUntyped.channel> | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const channelName = `chatbot-notifications-${tenantId}`;
    const channel = supabaseUntyped.channel(channelName);

    channel
      .on("broadcast", { event: "bot_paused" }, (payload: any) => {
        const data = payload?.payload;
        if (!data) return;

        const leadName = data.lead_name || "Lead";
        const reason = data.pause_reason;

        if (reason === "interessado_agendar") {
          toast.success(`${leadName} quer agendar consulta!`, {
            description: `Tratamento: ${data.detected_treatment || "não informado"} | Horários: ${data.detected_times || "não informado"}`,
            duration: 10000,
          });
        } else if (reason === "atencao") {
          toast.warning(`${leadName} precisa de atenção humana`, {
            description: "O bot não conseguiu responder. Verifique o Kanban.",
            duration: 10000,
          });
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [tenantId]);
}
