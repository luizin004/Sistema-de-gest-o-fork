import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EngagementFunnel } from "./EngagementFunnel";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EngagementFunnelDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FunnelData {
  respondeu: number;
  interagiu: number;
  engajou: number;
  impecilho: number;
  cadencia: number;
  total: number;
}

export const EngagementFunnelDialog = ({ isOpen, onClose }: EngagementFunnelDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState<FunnelData>({
    respondeu: 0,
    interagiu: 0,
    engajou: 0,
    impecilho: 0,
    cadencia: 0,
    total: 0,
  });

  useEffect(() => {
    if (isOpen) {
      fetchFunnelData();
    }
  }, [isOpen]);

  const fetchFunnelData = async () => {
    setLoading(true);
    try {
      // Busca todos os leads
      const { data: allLeads, error: leadsError } = await supabase
        .from('posts')
        .select('id, telefone, status');

      if (leadsError) throw leadsError;

      if (!allLeads || allLeads.length === 0) {
        setFunnelData({
          respondeu: 0,
          interagiu: 0,
          engajou: 0,
          impecilho: 0,
          cadencia: 0,
          total: 0,
        });
        setLoading(false);
        return;
      }

      // Filtra leads com status de engajamento
      const engagementStatuses = ['respondeu', 'interagiu', 'engajou', 'impecilho', 'cadencia', 'cadência'];
      const leadsWithEngagement = allLeads.filter(lead => {
        const status = lead.status?.toLowerCase().trim();
        return status && engagementStatuses.includes(status);
      });

      // Conta os status de engajamento
      const statusCounts = {
        respondeu: 0,
        interagiu: 0,
        engajou: 0,
        impecilho: 0,
        cadencia: 0,
      };

      leadsWithEngagement.forEach(lead => {
        const status = lead.status?.toLowerCase().trim();
        
        if (status === 'respondeu') statusCounts.respondeu++;
        else if (status === 'interagiu') statusCounts.interagiu++;
        else if (status === 'engajou') statusCounts.engajou++;
        else if (status === 'impecilho') statusCounts.impecilho++;
        else if (status === 'cadencia' || status === 'cadência') statusCounts.cadencia++;
      });

      setFunnelData({
        ...statusCounts,
        total: leadsWithEngagement.length,
      });
    } catch (error) {
      console.error('Erro ao buscar dados do funil:', error);
      toast.error('Erro ao carregar dados do funil de engajamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Funil de Engajamento</DialogTitle>
          <DialogDescription>
            Visualização do engajamento dos leads que entraram em contato
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <EngagementFunnel data={funnelData} />
        )}
      </DialogContent>
    </Dialog>
  );
};
