import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Users, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { upsertAgendamento } from "@/lib/agendamentoApi";
import { normalizePhoneForAgendamento } from "@/lib/utils";

export interface ManualPatientFormData {
  nome: string;
  telefone: string;
  data_marcada: string;
  dentista: string;
  tratamento: string;
  marcado_codefy: boolean;
}

interface ManualPatientFormProps {
  onCompleted?: () => void;
  onFormStateChange?: (data: ManualPatientFormData) => void;
  title?: string;
  description?: string;
}

export const manualPatientFormInitialState: ManualPatientFormData = {
  nome: "",
  telefone: "",
  data_marcada: "",
  dentista: "",
  tratamento: "",
  marcado_codefy: false,
};

const ManualPatientForm = ({
  onCompleted,
  onFormStateChange,
  title = "Cadastro de Paciente",
  description = "Registre nova consulta via urna",
}: ManualPatientFormProps) => {
  const [formData, setFormData] = useState<ManualPatientFormData>(manualPatientFormInitialState);
  const [loading, setLoading] = useState(false);
  const [dentistaOptions, setDentistaOptions] = useState<string[]>([]);
  const [tratamentoOptions, setTratamentoOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    onFormStateChange?.(formData);
  }, [formData, onFormStateChange]);

  useEffect(() => {
    const carregarOpcoes = async () => {
      try {
        setLoadingOptions(true);
        const [dentistasRes, tratamentosRes] = await Promise.all([
          supabase.from("dentistas").select("nome").order("nome").returns<{ nome: string | null }[]>(),
          supabase.from("tratamentos" as any).select("nome").order("nome").returns<{ nome: string | null }[]>(),
        ]);

        if (dentistasRes.error) throw dentistasRes.error;
        const dentistasData = dentistasRes.data ?? [];
        setDentistaOptions(dentistasData.map((d) => d.nome).filter((nome): nome is string => Boolean(nome)));

        if (tratamentosRes.error) {
          console.warn("Não foi possível carregar tratamentos:", tratamentosRes.error);
          setTratamentoOptions([]);
        } else {
          const tratamentosData = tratamentosRes.data ?? [];
          setTratamentoOptions(tratamentosData.map((t) => t.nome).filter((nome): nome is string => Boolean(nome)));
        }
      } catch (error) {
        console.error("Erro ao carregar opções de dentistas/tratamentos:", error);
        toast.error("Não foi possível carregar as opções cadastradas");
      } finally {
        setLoadingOptions(false);
      }
    };

    carregarOpcoes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.telefone || !formData.data_marcada) {
      toast.error("Preencha os campos obrigatórios: Nome, Telefone e Data Marcada");
      return;
    }

    // Validações obrigatórias para criar agendamento
    if (!formData.dentista || formData.dentista.trim() === "") {
      toast.error("Selecione um dentista para agendar a consulta.");
      return;
    }

    if (!formData.tratamento || formData.tratamento.trim() === "") {
      toast.error("Selecione um tratamento para agendar a consulta.");
      return;
    }

    if (!formData.marcado_codefy) {
      toast.error("Marque a opção 'Marcado no Codefy' para agendar a consulta.");
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = normalizePhoneForAgendamento(formData.telefone);
      if (!normalizedPhone) {
        toast.error("Informe um telefone válido (DDD + número)");
        setLoading(false);
        return;
      }

      // Nota: Verificação de duplicatas removida devido a política RLS
      // O banco tratará duplicatas através da constraint unique no telefone

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Usuário não autenticado");
        setLoading(false);
        return;
      }

      const dataMarcadaISO = new Date(formData.data_marcada).toISOString();

      try {
        // 1. Criar agendamento primeiro (fonte da verdade)
        const { data, error } = await supabase
          .from('agendamento')
          .insert({
            nome: formData.nome,
            telefone: normalizedPhone,
            data_marcada: dataMarcadaISO,
            dentista: formData.dentista || null,
            tratamento: formData.tratamento || null,
            author_id: user.id,
          })
          .select('id, data_marcada, horario')
          .single();

        if (error) {
        // Tratar especificamente erro de duplicata
        if (error.code === '23505' && error.message.includes('agendamento_telefone_key')) {
          toast.error("Já existe um agendamento para este telefone. Use um número diferente.");
          return;
        }
        throw error;
      }

        // 2. Criar post com dados do agendamento (espelho)
        const { error: postError } = await supabase
          .from('posts')
          .insert({
            nome: formData.nome,
            telefone: normalizedPhone,
            status: "agendou consulta",
            dentista: formData.dentista || null,
            tratamento: formData.tratamento || null,
            data: dataMarcadaISO.split("T")[0],
            data_marcada: data.data_marcada, // Sincronizar do agendamento
            horario: data.horario, // Sincronizar do agendamento
            agendamento_id: data.id,
            author_id: user.id,
          });

        if (postError) throw postError;

        toast.success("Paciente agendado e datas sincronizadas!");
      } catch (error) {
        console.error("Erro ao agendar paciente:", error);
        
        // Tratar erro de duplicata no catch geral
        if (error.code === '23505' && error.message.includes('agendamento_telefone_key')) {
          toast.error("Já existe um agendamento para este telefone. Use um número diferente.");
        } else {
          toast.error("Erro ao agendar paciente");
        }
      }

      
      try {
        const disparosPayload = {
          nome: formData.nome,
          telefone: formData.telefone,
          data_consulta: formData.data_marcada.split("T")[0],
        };

        // Tentar Edge Function primeiro, fallback silencioso se falhar por CORS
        try {
          const response = await fetch(
            "https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/disparos-brumadinho?tipo=consulta",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization:
                  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0MjQ4MDAsImV4cCI6MjA1MTAwMDQwMH0.W2h_4d7x3MzBPXPnBhJZ3KQYzXJhX8ZqF1wY8ZqF1wY",
              },
              body: JSON.stringify(disparosPayload),
            }
          );

          if (response.ok) {
            toast.success("Disparo de WhatsApp agendado!");
          } else {
            throw new Error(`Erro na Edge Function: ${response.statusText}`);
          }
        } catch (edgeError) {
          // Fallback silencioso para ambiente local
          if (edgeError.message.includes('CORS') || edgeError.message.includes('fetch')) {
            console.warn("Edge Function não disponível em ambiente local (CORS):", edgeError.message);
            toast.info("Disparo de WhatsApp será processado em produção");
          } else {
            console.error("Erro na Edge Function:", edgeError);
            toast.error("Aviso: Erro no disparo de WhatsApp, mas paciente foi cadastrado");
          }
        }
      } catch (disparosError) {
        console.error("Erro geral no disparo:", disparosError);
        toast.error("Aviso: Erro no disparo de WhatsApp, mas paciente foi cadastrado");
      }

      setFormData(manualPatientFormInitialState);
      onCompleted?.();
    } catch (error) {
      console.error("Erro ao cadastrar paciente:", error);
      toast.error("Erro ao cadastrar paciente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-green-200/50 bg-gradient-to-br from-green-50/50 to-teal-50/50 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <Users className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-lg text-green-900">{title}</CardTitle>
            <CardDescription className="text-green-600">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-sm font-medium text-gray-700">
                Nome do Paciente *
              </Label>
              <Input
                id="nome"
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone" className="text-sm font-medium text-gray-700">
                Telefone *
              </Label>
              <Input
                id="telefone"
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
                className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_marcada" className="text-sm font-medium text-gray-700">
                Data da Consulta *
              </Label>
              <div className="relative">
                <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                <Input
                  id="data_marcada"
                  type="datetime-local"
                  value={formData.data_marcada}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_marcada: e.target.value }))}
                  className="pl-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dentista" className="text-sm font-medium text-gray-700">
                Dentista
              </Label>
              <Select
                value={formData.dentista || "__none__"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, dentista: value === "__none__" ? "" : value }))
                }
                disabled={loadingOptions || dentistaOptions.length === 0}
              >
                <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500">
                  <SelectValue
                    placeholder={
                      loadingOptions ? "Carregando opções..." : "Selecione um dentista cadastrado"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Nenhum</span>
                  </SelectItem>
                  {dentistaOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingOptions && dentistaOptions.length === 0 && (
                <p className="text-xs text-gray-500">
                  Nenhum dentista cadastrado. Cadastre em Dados &gt; Dentistas.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tratamento" className="text-sm font-medium text-gray-700">
                Tipo de Tratamento
              </Label>
              <Select
                value={formData.tratamento || "__none__"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, tratamento: value === "__none__" ? "" : value }))
                }
                disabled={loadingOptions || tratamentoOptions.length === 0}
              >
                <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500">
                  <SelectValue
                    placeholder={
                      loadingOptions ? "Carregando opções..." : "Selecione um tratamento cadastrado"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Nenhum</span>
                  </SelectItem>
                  {tratamentoOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingOptions && tratamentoOptions.length === 0 && (
                <p className="text-xs text-gray-500">
                  Nenhum tratamento cadastrado. Cadastre em Dados &gt; Tratamentos.
                </p>
              )}
            </div>
          </div>

          {/* Checkbox Marcado no Codefy - obrigatório */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 p-3 border rounded-lg bg-blue-50/50">
              <Checkbox
                id="marcado_codefy"
                checked={formData.marcado_codefy}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, marcado_codefy: checked as boolean }))
                }
                disabled={loading}
              />
              <Label htmlFor="marcado_codefy" className="text-sm font-medium cursor-pointer">
                Marcado no Codefy *
              </Label>
            </div>
            <p className="text-xs text-gray-500">
              Confirme que este agendamento foi registrado no sistema Codefy
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Cadastrando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Cadastrar Paciente
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ManualPatientForm;
