import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Home, Building, Clock, Users, Edit, Trash2, Plus, Search, XCircle, Minimize2, Maximize2, Calendar, User, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Dentista {
  id: string;
  nome: string;
  especialidade: string;
  ativo: boolean;
  created_at: string;
}

interface Consultorio {
  id: string;
  nome: string;
  numero: number;
  ativo: boolean;
  created_at: string;
}

interface EscalaSemanal {
  id: string;
  dentista_id: string;
  consultorio_id: string;
  dia_semana: number;
  horario_inicio: string;
  created_at: string;
  semana?: number;
}

const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const diaParaNumero: { [key: string]: number } = {
  'Segunda': 1,
  'Terça': 2,
  'Quarta': 3,
  'Quinta': 4,
  'Sexta': 5,
  'Sábado': 6,
  'Domingo': 7
};
const horas = ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30'];

const weekTransitionStyles = `
  @keyframes weekFadeSlide {
    0% {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .week-transition-animation {
    animation: weekFadeSlide 0.45s ease;
  }
`;

const weekConfig = {
  1: { name: 'Semana 1', color: 'sky', bg: 'bg-sky-500', hover: 'hover:bg-sky-600', light: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  2: { name: 'Semana 2', color: 'rose', bg: 'bg-rose-500', hover: 'hover:bg-rose-600', light: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  3: { name: 'Semana 3', color: 'violet', bg: 'bg-violet-500', hover: 'hover:bg-violet-600', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  4: { name: 'Semana 4', color: 'amber', bg: 'bg-amber-500', hover: 'hover:bg-amber-600', light: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' }
};

export default function ConsultoriosSupabase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados
  const [dentistas, setDentistas] = useState<Dentista[]>([]);
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [escalaSemanal, setEscalaSemanal] = useState<EscalaSemanal[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedDentista, setSelectedDentista] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEspecialidade, setSelectedEspecialidade] = useState<string>('all');
  
  // Estados de seleção
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{dia: string, hora: string, consultorioId: string} | null>(null);
  const [showConfirmationButton, setShowConfirmationButton] = useState(false);
  const [showSaturday, setShowSaturday] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(1);
  
  // Estados de UI
  const [modo, setModo] = useState<'alocacao' | 'exclusao'>('alocacao');
  const [tabelasExpandidas, setTabelasExpandidas] = useState<{[key: string]: boolean}>({});
  const [dentistaListExpanded, setDentistaListExpanded] = useState(true);
  
  // Diálogos
  const [showDentistaDialog, setShowDentistaDialog] = useState(false);
  const [editingDentista, setEditingDentista] = useState<Dentista | null>(null);
  const [newDentista, setNewDentista] = useState({ nome: '', especialidade: '' });
  const [showAlocacoesDialog, setShowAlocacoesDialog] = useState(false);
  const [selectedDentistaForAlocacoes, setSelectedDentistaForAlocacoes] = useState<Dentista | null>(null);
  const [selectedWeekForAlocacoes, setSelectedWeekForAlocacoes] = useState(1);

  // Carregar dados
  useEffect(() => {
    carregarDados();
  }, [selectedWeek]);

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = weekTransitionStyles;
    document.head.appendChild(styleElement);

    return () => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  // Evento global para mouseUp
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        handleMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isSelecting, selectedCells, selectedDentista]);

  const visibleDias = useMemo(
    () => (showSaturday ? diasSemana : diasSemana.filter((dia) => dia !== 'Sábado')),
    [showSaturday]
  );

  const carregarDados = async (isInitial = false) => {
    try {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setLoading(true);
      }

      // Obter tenant_id do usuário logado
      const usuarioStr = localStorage.getItem('usuario');
      const usuario = usuarioStr ? JSON.parse(usuarioStr) : null;
      const tenantId = usuario?.tenant_id;

      if (!tenantId) {
        throw new Error('Usuário não autenticado ou sem tenant');
      }
      
      const [dentistasRes, consultoriosRes, escalaRes] = await Promise.all([
        supabase.from('dentistas').select('*').eq('tenant_id', tenantId).order('nome'),
        supabase.from('consultorios').select('*').eq('tenant_id', tenantId).order('numero'),
        supabase.from('escala_semanal').select('*').eq('tenant_id', tenantId).order('semana').order('dia_semana').order('horario_inicio')
      ]);

      if (dentistasRes.error) throw dentistasRes.error;
      if (consultoriosRes.error) throw consultoriosRes.error;
      if (escalaRes.error) throw escalaRes.error;

      setDentistas(dentistasRes.data || []);
      setConsultorios(consultoriosRes.data || []);
      setEscalaSemanal(escalaRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  // Funções de gerenciamento
  const salvarDentista = async () => {
    try {
      // Obter tenant_id do usuário logado
      const usuarioStr = localStorage.getItem('usuario');
      const usuario = usuarioStr ? JSON.parse(usuarioStr) : null;
      const tenantId = usuario?.tenant_id;

      if (!tenantId) {
        throw new Error('Usuário não autenticado ou sem tenant');
      }

      if (editingDentista) {
        const { error } = await supabase
          .from('dentistas')
          .update(newDentista)
          .eq('id', editingDentista.id)
          .eq('tenant_id', tenantId);
        
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Dentista atualizado com sucesso' });
      } else {
        const { data, error } = await supabase
          .from('dentistas')
          .insert([{ ...newDentista, ativo: true, tenant_id: tenantId }])
          .select();
        
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Dentista cadastrado com sucesso' });
      }
      
      setShowDentistaDialog(false);
      setEditingDentista(null);
      setNewDentista({ nome: '', especialidade: '' });
      carregarDados();
    } catch (error) {
      console.error('Erro ao salvar dentista:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o dentista',
        variant: 'destructive',
      });
    }
  };

  const excluirDentista = async (id: string) => {
    try {
      // Obter tenant_id do usuário logado
      const usuarioStr = localStorage.getItem('usuario');
      const usuario = usuarioStr ? JSON.parse(usuarioStr) : null;
      const tenantId = usuario?.tenant_id;

      if (!tenantId) {
        throw new Error('Usuário não autenticado ou sem tenant');
      }

      const { error } = await supabase
        .from('dentistas')
        .update({ ativo: false })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Dentista excluído com sucesso' });
      carregarDados();
    } catch (error) {
      console.error('Erro ao excluir dentista:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o dentista',
        variant: 'destructive',
      });
    }
  };

  // Funções de seleção
  const handleMouseDown = (dia: string, hora: string, consultorioId: string) => {
    // Não confirma mais automaticamente, apenas inicia seleção
    setIsSelecting(true);
    setSelectionStart({ dia, hora, consultorioId });
    setSelectedCells(new Set([`${consultorioId}|${dia}|${hora}`]));
  };

  const handleMouseEnter = (dia: string, hora: string, consultorioId: string) => {
    if (isSelecting && selectionStart && selectionStart.consultorioId === consultorioId) {
      const newSelection = new Set<string>();
      
      const dias = [...visibleDias];
      const startDiaIndex = dias.indexOf(selectionStart.dia);
      const endDiaIndex = dias.indexOf(dia);
      const startHoraIndex = horas.indexOf(selectionStart.hora);
      const endHoraIndex = horas.indexOf(hora);
      
      const minDiaIndex = Math.min(startDiaIndex, endDiaIndex);
      const maxDiaIndex = Math.max(startDiaIndex, endDiaIndex);
      const minHoraIndex = Math.min(startHoraIndex, endHoraIndex);
      const maxHoraIndex = Math.max(startHoraIndex, endHoraIndex);
      
      for (let d = minDiaIndex; d <= maxDiaIndex; d++) {
        for (let h = minHoraIndex; h <= maxHoraIndex; h++) {
          newSelection.add(`${consultorioId}|${dias[d]}|${horas[h]}`);
        }
      }
      
      setSelectedCells(newSelection);
    }
  };

  const handleMouseUp = () => {
    // Apenas finaliza a seleção, não mostra botão automaticamente
    setIsSelecting(false);
    setSelectionStart(null);
  };

  const confirmSelectionAction = async () => {
    if (selectedCells.size === 0) return;

    try {
      // Obter tenant_id do usuário logado
      const usuarioStr = localStorage.getItem('usuario');
      const usuario = usuarioStr ? JSON.parse(usuarioStr) : null;
      const tenantId = usuario?.tenant_id;

      if (!tenantId) {
        throw new Error('Usuário não autenticado ou sem tenant');
      }

      if (modo === 'exclusao') {
        const cellsToDelete = Array.from(selectedCells);
        const deletePromises = cellsToDelete.map(async cell => {
          const [consultorioId, dia, hora] = cell.split('|');
          
          return supabase
            .from('escala_semanal')
            .delete()
            .eq('consultorio_id', consultorioId)
            .eq('dia_semana', diaParaNumero[dia])
            .eq('horario_inicio', hora + ':00')
            .eq('semana', selectedWeek)
            .eq('tenant_id', tenantId);
        });

        await Promise.all(deletePromises);
        toast({
          title: 'Sucesso',
          description: `${selectedCells.size} horários removidos com sucesso`,
        });
      } else if (modo === 'alocacao' && selectedDentista) {
        const escalasToInsert = Array.from(selectedCells).map(cell => {
          const [consultorioId, dia, hora] = cell.split('|');
          return {
            dentista_id: selectedDentista,
            consultorio_id: consultorioId,
            dia_semana: diaParaNumero[dia],
            horario_inicio: hora + ':00',
            semana: selectedWeek,
            tenant_id: tenantId
          };
        });

        const { error } = await supabase
          .from('escala_semanal')
          .insert(escalasToInsert);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: `${selectedCells.size} horários alocados com sucesso`,
        });
      } else {
        toast({
          title: 'Atenção',
          description: 'Selecione um dentista para alocar horários',
          variant: 'destructive',
        });
        return;
      }

      carregarDados();
    } catch (error) {
      console.error('Erro ao processar horários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar os horários',
        variant: 'destructive',
      });
    } finally {
      setShowConfirmationButton(false);
      setSelectedCells(new Set());
    }
  };

  // Dados filtrados
  const dentistasFiltrados = useMemo(() => {
    return dentistas.filter(dentista => {
      const matchesSearch = dentista.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           dentista.especialidade.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [dentistas, searchTerm]);

  const getEscalaForCell = (dia: string, hora: string, consultorioId: string) => {
    const diaNumero = diaParaNumero[dia];
    const escala = escalaFiltradaPorEspecialidade.find(escala => 
      escala.dia_semana === diaNumero && 
      escala.horario_inicio.startsWith(hora) && // Corrigido: usa startsWith para "11:30:00" vs "11:30"
      escala.consultorio_id === consultorioId &&
      (escala.semana === selectedWeek || (!escala.semana && selectedWeek === 1))
    );
    
    return escala;
  };

  // Função para verificar se um horário original corresponde ao filtro
  const getEscalaOriginalForCell = (dia: string, hora: string, consultorioId: string) => {
    const diaNumero = diaParaNumero[dia];
    const escala = escalaSemanal.find(escala => 
      escala.dia_semana === diaNumero && 
      escala.horario_inicio.startsWith(hora) &&
      escala.consultorio_id === consultorioId &&
      (escala.semana === selectedWeek || (!escala.semana && selectedWeek === 1))
    );
    
    return escala;
  };

  // Verificar se o horário deve ser desabilitado
  const shouldDisableCell = (dia: string, hora: string, consultorioId: string) => {
    if (selectedEspecialidade === 'all' || selectedEspecialidade === '') return false;
    
    const escalaOriginal = getEscalaOriginalForCell(dia, hora, consultorioId);
    if (!escalaOriginal) return false;
    
    const dentista = getDentistaById(escalaOriginal.dentista_id);
    return dentista?.especialidade !== selectedEspecialidade;
  };

  // Função utilitária para agrupar horários consecutivos
  const agruparHorarios = (alocacoes: {consultorio: number, horario: string}[]) => {
    if (!alocacoes.length) return [];
    
    // Ordenar por horário
    const alocacoesOrdenadas = [...alocacoes].sort((a, b) => a.horario.localeCompare(b.horario));
    
    const grupos = [];
    let grupoAtual = {
      consultorio: alocacoesOrdenadas[0].consultorio,
      horarioInicio: alocacoesOrdenadas[0].horario,
      horarioFim: alocacoesOrdenadas[0].horario,
      horarios: [alocacoesOrdenadas[0].horario]
    };
    
    for (let i = 1; i < alocacoesOrdenadas.length; i++) {
      const atual = alocacoesOrdenadas[i];
      const anterior = alocacoesOrdenadas[i - 1];
      
      // Verificar se é consecutivo (diferença de 1 hora)
      const horaAtual = parseInt(atual.horario.split(':')[0]);
      const horaAnterior = parseInt(anterior.horario.split(':')[0]);
      const ehConsecutivo = horaAtual === horaAnterior + 1;
      
      // Verificar se é mesmo consultório e consecutivo
      if (atual.consultorio === grupoAtual.consultorio && ehConsecutivo) {
        // Adicionar ao grupo atual
        grupoAtual.horarioFim = atual.horario;
        grupoAtual.horarios.push(atual.horario);
      } else {
        // Fechar grupo atual e iniciar novo
        grupos.push({...grupoAtual});
        grupoAtual = {
          consultorio: atual.consultorio,
          horarioInicio: atual.horario,
          horarioFim: atual.horario,
          horarios: [atual.horario]
        };
      }
    }
    
    // Adicionar último grupo
    grupos.push(grupoAtual);
    
    // Calcular horário final correto (último horário + 1 hora)
    return grupos.map(grupo => {
      const ultimaHora = parseInt(grupo.horarioFim.split(':')[0]);
      const horaFinal = (ultimaHora + 1).toString().padStart(2, '0') + ':30';
      
      return {
        ...grupo,
        horarioFimCalculado: horaFinal,
        horarioFormatado: grupo.horarios.length === 1 
          ? grupo.horarioInicio 
          : `${grupo.horarioInicio} às ${horaFinal}`
      };
    });
  };

  // Obter alocações de um dentista
  const getAlocacoesDentista = (dentistaId: string, weekNumber?: number) => {
    const semanaParaUsar = weekNumber || selectedWeek;
    const alocacoes = escalaSemanal.filter(escala => 
      escala.dentista_id === dentistaId && 
      (escala.semana === semanaParaUsar || (!escala.semana && semanaParaUsar === 1))
    );
    
    // Agrupar por dia e consultório
    const alocacoesPorDia = alocacoes.reduce((acc, escala) => {
      const diaNome = Object.keys(diaParaNumero).find(key => diaParaNumero[key] === escala.dia_semana);
      const consultorio = consultorios.find(c => c.id === escala.consultorio_id);
      
      if (!acc[diaNome]) {
        acc[diaNome] = [];
      }
      
      acc[diaNome].push({
        consultorio: Number(consultorio?.numero) || 0,
        horario: escala.horario_inicio.substring(0, 5)
      });
      
      return acc;
    }, {} as Record<string, {consultorio: number, horario: string}[]>);
    
    return alocacoesPorDia;
  };

  const getDentistaById = (id: string): Dentista | undefined => {
    return dentistas.find(d => d.id === id);
  };

  // Obter especialidades únicas
  const especialidadesUnicas = useMemo(() => {
    const especialidades = new Set(dentistas.map(d => d.especialidade).filter(Boolean));
    return Array.from(especialidades).sort();
  }, [dentistas]);

  // Filtrar escala por especialidade
  const escalaFiltradaPorEspecialidade = useMemo(() => {
    if (selectedEspecialidade === 'all' || selectedEspecialidade === '') return escalaSemanal;
    
    return escalaSemanal.filter(escala => {
      const dentista = getDentistaById(escala.dentista_id);
      return dentista?.especialidade === selectedEspecialidade;
    });
  }, [escalaSemanal, selectedEspecialidade, dentistas]);

  // Calcular estatísticas gerais
  const calcularEstatisticasGerais = useMemo(() => {
    // Considerar apenas dias úteis (excluir sábado)
    const diasUteis = diasSemana.filter(dia => dia !== 'Sábado');
    const totalSlots = consultorios.length * diasUteis.length * horas.length;
    
    // Filtrar slots válidos (remover duplicatas e inválidos)
    const validSlots = escalaSemanal.filter(slot => {
      // Filtrar pela semana selecionada
      const slotSemana = slot.semana || 1;
      if (slotSemana !== selectedWeek) return false;

      // Excluir sábados dos cálculos
      const diaNome = Object.keys(diaParaNumero).find(key => diaParaNumero[key] === slot.dia_semana);
      if (diaNome === 'Sábado') return false;

      const consultorioExists = consultorios.some(c => c.id === slot.consultorio_id);
      const dentistaExists = dentistas.some(d => d.id === slot.dentista_id);
      const validDia = Object.values(diaParaNumero).includes(slot.dia_semana);
      const validHora = horas.some(h => slot.horario_inicio.startsWith(h));
      
      return consultorioExists && dentistaExists && validDia && validHora;
    });
    
    const occupiedSlots = validSlots.length;
    const lotacaoGeral = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;
    
    return {
      totalSlots,
      occupiedSlots,
      lotacaoGeral: Math.min(Math.round(lotacaoGeral * 10) / 10, 100)
    };
  }, [consultorios, escalaSemanal, dentistas, selectedWeek]);

  // Calcular estatísticas de uso dos consultórios
  const calcularEstatisticasConsultorios = useMemo(() => {
    // Considerar apenas dias úteis (excluir sábado)
    const diasUteis = diasSemana.filter(dia => dia !== 'Sábado');
    const totalSlots = consultorios.length * diasUteis.length * horas.length;
    
    // Filtrar slots válidos (remover duplicatas e inválidos)
    const validSlots = escalaSemanal.filter(slot => {
      // Filtrar pela semana selecionada (considerando null/undefined como semana 1)
      const slotSemana = slot.semana || 1;
      if (slotSemana !== selectedWeek) return false;

      // Excluir sábados dos cálculos
      const diaNome = Object.keys(diaParaNumero).find(key => diaParaNumero[key] === slot.dia_semana);
      if (diaNome === 'Sábado') return false;

      const consultorioExists = consultorios.some(c => c.id === slot.consultorio_id);
      const dentistaExists = dentistas.some(d => d.id === slot.dentista_id);
      const validDia = Object.values(diaParaNumero).includes(slot.dia_semana);
      const validHora = horas.some(h => slot.horario_inicio.startsWith(h));
      
      return consultorioExists && dentistaExists && validDia && validHora;
    });
    
    const occupiedSlots = validSlots.length;
    
    const estatisticasPorConsultorio = consultorios.map(consultorio => {
      // Filtrar slots válidos apenas para este consultório
      const consultorioSlots = validSlots.filter(e => e.consultorio_id === consultorio.id);
      
      // Remover duplicatas (mesmo dia, hora e consultório)
      const uniqueSlots = consultorioSlots.filter((slot, index, self) => 
        index === self.findIndex((s) => 
          s.dia_semana === slot.dia_semana && 
          s.horario_inicio === slot.horario_inicio &&
          s.consultorio_id === slot.consultorio_id
        )
      );
      
      const totalConsultorioSlots = diasUteis.length * horas.length;
      const porcentagemUso = totalConsultorioSlots > 0 ? (uniqueSlots.length / totalConsultorioSlots) * 100 : 0;
      
      return {
        consultorioId: consultorio.id,
        consultorioNumero: consultorio.numero,
        slotsOcupados: uniqueSlots.length,
        slotsTotais: totalConsultorioSlots,
        porcentagemUso: Math.min(Math.round(porcentagemUso * 10) / 10, 100) // Limitar a 100%
      };
    });
    
    const lotacaoGeral = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;
    
    return {
      lotacaoGeral: Math.min(Math.round(lotacaoGeral * 10) / 10, 100), // Limitar a 100%
      estatisticasPorConsultorio
    };
  }, [consultorios, escalaSemanal, dentistas, selectedWeek]);

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando consultórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 hover:bg-blue-50"
              >
                <Home className="h-4 w-4" />
                <span>Início</span>
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Consultórios</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => setShowDentistaDialog(true)}
                className="flex items-center space-x-1"
              >
                <User className="h-4 w-4" />
                <span>Novo dentista</span>
              </Button>
              
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {new Date().toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Dentistas List */}
          <div className="lg:col-span-1 lg:max-w-xs">
            <Card>
              <CardHeader>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Users className="h-5 w-5" />
                        <span>Dentistas</span>
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDentistaListExpanded(!dentistaListExpanded)}
                        className="h-8 w-8 p-0"
                      >
                        {dentistaListExpanded ? (
                          <Minimize2 className="h-4 w-4" />
                        ) : (
                          <Maximize2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar dentista..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full"
                      />
                    </div>
                    <Select value={selectedEspecialidade} onValueChange={setSelectedEspecialidade}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Especialidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas Especialidades</SelectItem>
                        {especialidadesUnicas.map(especialidade => (
                          <SelectItem key={especialidade} value={especialidade}>
                            {especialidade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={`transition-all duration-300 ${
                dentistaListExpanded ? 'max-h-none' : 'max-h-20 overflow-hidden'
              }`}>
                {dentistaListExpanded ? (
                  <div className="space-y-3">
                    {dentistasFiltrados.map((dentista) => (
                    <div
                      key={dentista.id}
                      className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        selectedDentista === dentista.id && modo === 'alocacao'
                          ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100 shadow-lg shadow-blue-200'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                      } ${!dentista.ativo ? 'opacity-60' : ''}`}
                      onClick={() => {
                        if (modo === 'alocacao') {
                          setSelectedDentista(dentista.id);
                        }
                      }}
                      style={{ userSelect: 'none' }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      <div className="relative p-4">
                        {/* Badge de horários no canto superior direito */}
                        <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                          {Object.values(getAlocacoesDentista(dentista.id))
                            .reduce((sum, alocacoes) => sum + alocacoes.length, 0)}
                        </div>
                        
                        <div className="flex items-start space-x-3 mb-3">
                          <div className={`w-12 h-12 min-w-[3rem] min-h-[3rem] shrink-0 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                            selectedDentista === dentista.id && modo === 'alocacao'
                              ? 'bg-blue-500'
                              : 'bg-gradient-to-br from-blue-500 to-purple-600'
                          }`}>
                            {dentista.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">{dentista.nome}</h3>
                            <p className="text-sm text-gray-600 font-medium">{dentista.especialidade}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              ID: {dentista.id.substring(0, 8)}
                            </span>
                          </div>
                          
                          {selectedDentista === dentista.id && modo === 'alocacao' && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex space-x-2 mt-3 pt-3 border-t border-gray-100">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDentistaForAlocacoes(dentista);
                              setSelectedWeekForAlocacoes(selectedWeek);
                              setShowAlocacoesDialog(true);
                            }}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Ver alocações"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDentista(dentista);
                              setNewDentista({
                                nome: dentista.nome,
                                especialidade: dentista.especialidade,
                              });
                              setShowDentistaDialog(true);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              excluirDentista(dentista.id);
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-gray-500">
                    <div className="flex items-center justify-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">Lista de dentistas reduzida</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 4 Tabelas de Consultórios Separados */}
          <div
            key={`week-${selectedWeek}`}
            className="lg:col-span-3 space-y-6 week-transition-animation relative"
          >
            {/* Inline Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  <span className="text-sm text-gray-600">Atualizando...</span>
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 mr-2">Visualizando:</span>
                {[1, 2, 3, 4].map((week) => {
                  const weekData = weekConfig[week as keyof typeof weekConfig];
                  return (
                  <Button
                    key={week}
                    variant={selectedWeek === week ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedWeek(week);
                      setSelectedCells(new Set()); // Limpar seleção ao trocar de semana
                    }}
                    className={`w-32 ${selectedWeek === week ? `${weekData.bg} ${weekData.hover}` : ''}`}
                  >
                    {weekData.name}
                  </Button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant={showSaturday ? "default" : "outline"}
                onClick={() => setShowSaturday((prev) => !prev)}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {showSaturday ? "Ocultar sábado" : "Incluir sábado"}
              </Button>
            </div>
            {/* Card de Lotação Geral */}
            <Card className={`border-${weekConfig[selectedWeek as keyof typeof weekConfig].color}-200 bg-gradient-to-r from-${weekConfig[selectedWeek as keyof typeof weekConfig].color}-50 to-indigo-50`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full ${weekConfig[selectedWeek as keyof typeof weekConfig].bg} flex items-center justify-center`}>
                      <Building className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Lotação Geral ({weekConfig[selectedWeek as keyof typeof weekConfig].name})</h3>
                      <p className="text-sm text-gray-600">Todos os consultórios</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold text-${weekConfig[selectedWeek as keyof typeof weekConfig].color}-600`}>
                      {calcularEstatisticasConsultorios.lotacaoGeral}%
                    </div>
                  </div>
                </div>
                
                {/* Barra de progresso */}
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ${weekConfig[selectedWeek as keyof typeof weekConfig].bg}`}
                      style={{ width: `${Math.min(calcularEstatisticasConsultorios.lotacaoGeral, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card de Estatísticas por Especialidade */}
            {selectedEspecialidade !== 'all' && selectedEspecialidade !== '' && (
              <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Especialidade: {selectedEspecialidade}</h3>
                        <p className="text-sm text-gray-600">Horários filtrados por especialidade</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-purple-600">
                        {escalaFiltradaPorEspecialidade.length}
                      </div>
                      <div className="text-sm text-gray-600">horários</div>
                    </div>
                  </div>
                  
                  {/* Barra de progresso para especialidade */}
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="h-3 rounded-full transition-all duration-500 bg-purple-500"
                        style={{ width: `${Math.min((escalaFiltradaPorEspecialidade.filter(slot => {
                          // Excluir sábados dos cálculos
                          const diaNome = Object.keys(diaParaNumero).find(key => diaParaNumero[key] === slot.dia_semana);
                          return diaNome !== 'Sábado';
                        }).length / (consultorios.length * (diasSemana.length - 1) * horas.length)) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      {escalaFiltradaPorEspecialidade.filter(slot => {
                        // Excluir sábados dos cálculos
                        const diaNome = Object.keys(diaParaNumero).find(key => diaParaNumero[key] === slot.dia_semana);
                        return diaNome !== 'Sábado';
                      }).length} de {consultorios.length * (diasSemana.length - 1) * horas.length} horários totais
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {consultorios.map((consultorio) => {
              const estatistica = calcularEstatisticasConsultorios.estatisticasPorConsultorio.find(
                e => e.consultorioId === consultorio.id
              );
              
              const weekData = weekConfig[selectedWeek as keyof typeof weekConfig];

              return (
              <Card key={consultorio.id} className="transition-all duration-300">
                <CardHeader className="pb-2 space-y-2">
                  <div className="flex justify-between items-center">
                    {tabelasExpandidas[consultorio.id] ? (
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-2">
                          <CardTitle className="flex items-center gap-2">
                            <Building className="h-5 w-5" />
                            <span>Consultório {consultorio.numero} <span className="text-sm font-normal text-gray-500 ml-1">({weekData.name})</span></span>
                            {selectedEspecialidade !== 'all' && selectedEspecialidade !== '' && (
                              <Badge variant="outline" className="ml-2 border-purple-200 text-purple-700 bg-purple-50">
                                Filtrado: {selectedEspecialidade}
                              </Badge>
                            )}
                          </CardTitle>
                        </div>
                        {/* Porcentagem de uso - Abaixo do nome */}
                        <div className="flex items-center mb-3">
                          <div className={`${weekData.light} ${weekData.text} px-3 py-1.5 rounded-full font-bold text-lg border ${weekData.border}`}>
                            {estatistica?.porcentagemUso || 0}%
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={modo === 'alocacao' ? 'default' : 'outline'}
                            onClick={() => {
                              setModo('alocacao');
                              setSelectedDentista('');
                            }}
                            className="flex items-center space-x-1 h-8"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Alocar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant={modo === 'exclusao' ? 'destructive' : 'outline'}
                            onClick={() => {
                              setModo('exclusao');
                              setSelectedDentista('');
                            }}
                            className="flex items-center space-x-1 h-8"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Excluir</span>
                          </Button>
                          <Badge variant={modo === 'alocacao' ? 'default' : 'destructive'}>
                            Modo: {modo === 'alocacao' ? 'Alocação' : 'Exclusão'}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col">
                          <CardTitle className="flex items-center gap-2">
                            <Building className="h-5 w-5" />
                            <span>Consultório {consultorio.numero} <span className="text-sm font-normal text-gray-500 ml-1">({weekData.name})</span></span>
                          </CardTitle>
                          {/* Porcentagem de uso quando retraído - Abaixo do nome */}
                          <div className="flex items-center mt-2">
                            <div className={`${weekData.light} ${weekData.text} px-2 py-1 rounded-full font-bold text-sm border ${weekData.border}`}>
                              {estatistica?.porcentagemUso || 0}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTabelasExpandidas(prev => ({
                        ...prev,
                        [consultorio.id]: !prev[consultorio.id]
                      }))}
                      className="flex items-center space-x-1"
                    >
                      {tabelasExpandidas[consultorio.id] ? (
                        <>
                          <Minimize2 className="h-4 w-4" />
                          <span>Reduzir</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="h-4 w-4" />
                          <span>Expandir</span>
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className={`transition-all duration-300 ${
                  tabelasExpandidas[consultorio.id] ? 'max-h-none' : 'max-h-20 overflow-hidden'
                }`}>
                  {!tabelasExpandidas[consultorio.id] ? (
                    <div className="p-3" aria-hidden />
                  ) : (
                    // Estado expandido - tabela completa
                    <>
                      <div className="overflow-x-auto" style={{ userSelect: 'none' }}>
                        <table className="min-w-full border-collapse table-fixed">
                          <thead>
                            <tr>
                              <th className="p-1 text-center font-semibold text-gray-700 bg-gray-50 rounded border w-[95px]">
                                Horário
                              </th>
                              {visibleDias.map((dia) => (
                                <th key={dia} className="p-1 text-center font-semibold text-gray-700 bg-gray-50 rounded border min-w-[120px]">
                                  {dia}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {horas.map((hora) => (
                              <tr key={hora}>
                                <td className="p-1 text-center text-sm font-medium text-gray-600 bg-gray-50 border w-[95px]">
                                  {hora}
                                </td>
                                {visibleDias.map((dia) => {
                                  const escala = getEscalaForCell(dia, hora, consultorio.id);
                                  const escalaOriginal = getEscalaOriginalForCell(dia, hora, consultorio.id);
                                  const isSelected = selectedCells.has(`${consultorio.id}|${dia}|${hora}`);
                                  const dentista = escala ? getDentistaById(escala.dentista_id) : null;
                                  const dentistaOriginal = escalaOriginal ? getDentistaById(escalaOriginal.dentista_id) : null;
                                  const isDisabled = shouldDisableCell(dia, hora, consultorio.id);
                                  
                                  return (
                                    <td
                                      key={`${consultorio.id}|${dia}|${hora}`}
                                      className={`p-2 border rounded-xl transition-all duration-200 min-h-[85px] h-[85px] align-top min-w-[130px] ${
                                        isSelected
                                          ? 'bg-gradient-to-br from-blue-100 to-blue-200 border-blue-400 shadow-lg transform scale-105'
                                          : isDisabled
                                          ? 'bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed'
                                          : escala
                                          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-300 hover:shadow-md hover:transform hover:scale-102 cursor-pointer'
                                          : 'bg-gradient-to-br from-white to-blue-50 border-blue-200 hover:border-blue-300 hover:shadow-md hover:transform hover:scale-102 cursor-pointer'
                                      }`}
                                      onMouseDown={() => !isDisabled && handleMouseDown(dia, hora, consultorio.id)}
                                      onMouseEnter={() => !isDisabled && handleMouseEnter(dia, hora, consultorio.id)}
                                      onMouseUp={handleMouseUp}
                                      style={{ userSelect: 'none' }}
                                    >
                                      {escala && dentista ? (
                                        <div className="h-full flex flex-col items-center justify-center p-2">
                                          <div className="text-center">
                                            <div className="text-sm font-bold text-gray-800 leading-tight">
                                              {dentista.nome.split(' ')[0]}
                                            </div>
                                            <div className="text-xs text-gray-500 leading-tight mt-1">
                                              {dentista.especialidade.substring(0, 15)}
                                            </div>
                                          </div>
                                        </div>
                                      ) : isDisabled && dentistaOriginal ? (
                                        <div className="h-full flex flex-col items-center justify-center p-2 opacity-60">
                                          <div className="text-center">
                                            <div className="text-sm font-semibold text-gray-500 leading-tight line-through">
                                              {dentistaOriginal.nome.split(' ')[0]}
                                            </div>
                                            <div className="text-xs text-gray-400 leading-tight mt-1">
                                              {dentistaOriginal.especialidade.substring(0, 15)}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="h-full flex flex-col items-center justify-center p-2">
                                          {isSelected ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-blue-100 rounded-lg border-2 border-blue-300">
                                              <Check className="h-4 w-4 text-blue-600 mb-1" />
                                              <span className="text-xs font-semibold text-blue-700">Selecionado</span>
                                            </div>
                                          ) : isDisabled ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center">
                                              <XCircle className="h-4 w-4 text-gray-400 mb-1" />
                                              <span className="text-xs text-gray-400">Indisponível</span>
                                            </div>
                                          ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center group">
                                              <Plus className="h-4 w-4 text-blue-500 mb-1 group-hover:text-blue-600 transition-colors" />
                                              <span className="text-xs text-blue-500 group-hover:text-blue-600 transition-colors">Livre</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                    </>
                  )}
                </CardContent>
              </Card>
            );
            })}
            
            {/* Botão de Confirmação Global */}
            {showConfirmationButton && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-blue-700">
                      <strong>{selectedCells.size}</strong> célula(s) selecionada(s) para {modo === 'alocacao' ? 'alocação' : 'exclusão'}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCells(new Set());
                          setShowConfirmationButton(false);
                        }}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={confirmSelectionAction}
                        className={modo === 'alocacao' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                      >
                        {modo === 'alocacao' ? 'Confirmar Alocação' : 'Confirmar Exclusão'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Diálogo de Alocações do Dentista */}
      <Dialog open={showAlocacoesDialog} onOpenChange={setShowAlocacoesDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Alocações - {selectedDentistaForAlocacoes?.nome}
              </DialogTitle>
              <DialogDescription>
                {selectedDentistaForAlocacoes?.especialidade}
              </DialogDescription>
            </div>
          </DialogHeader>
          
          {selectedDentistaForAlocacoes && (
            <div className="space-y-4">
              {/* Nome do dentista no topo */}
              <div className="text-lg font-semibold text-gray-900">
                {selectedDentistaForAlocacoes.nome}
              </div>
              
              {/* Mostrar sempre todas as semanas */}
              <div className="space-y-6">
                {[1, 2, 3, 4].map(weekNum => {
                  const alocacoesSemana = getAlocacoesDentista(selectedDentistaForAlocacoes.id, weekNum);
                  
                  return (
                    <div key={weekNum} className="space-y-3">
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full ${weekConfig[weekNum as keyof typeof weekConfig].bg} flex items-center justify-center text-white text-sm font-bold`}>
                          {weekNum}
                        </div>
                        {weekConfig[weekNum as keyof typeof weekConfig].name}
                      </h4>
                      
                      <div className="pl-6 space-y-2">
                        {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(dia => {
                          const alocacoesDia = alocacoesSemana[dia];
                          if (!alocacoesDia || alocacoesDia.length === 0) {
                            return (
                              <div key={dia} className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-gray-700 w-12">{dia.substring(0, 3).toLowerCase()}:</span>
                                <span className="text-gray-500">livre</span>
                              </div>
                            );
                          }
                          
                          return (
                            <div key={dia} className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-gray-700 w-12">{dia.substring(0, 3).toLowerCase()}:</span>
                              <div className="flex flex-wrap gap-2">
                                {agruparHorarios(alocacoesDia).map((grupo, index) => (
                                  <span key={index} className="text-gray-900">
                                    {grupo.horarioFormatado}
                                    {grupo.consultorio && (
                                      <span className="text-gray-500 ml-1">(cons. {grupo.consultorio})</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlocacoesDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dentista Dialog */}
      <Dialog open={showDentistaDialog} onOpenChange={setShowDentistaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDentista ? 'Editar Dentista' : 'Novo Dentista'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do dentista
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={newDentista.nome}
                onChange={(e) => setNewDentista({ ...newDentista, nome: e.target.value })}
                placeholder="Nome do dentista"
              />
            </div>
            <div>
              <Label htmlFor="especialidade">Especialidade</Label>
              <Input
                id="especialidade"
                value={newDentista.especialidade}
                onChange={(e) => setNewDentista({ ...newDentista, especialidade: e.target.value })}
                placeholder="Especialidade"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDentistaDialog(false);
                setEditingDentista(null);
                setNewDentista({ nome: '', especialidade: '' });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={salvarDentista}>
              {editingDentista ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botão Flutuante de Aplicar */}
      {selectedCells.size > 0 && (
        <div className="fixed bottom-20 right-8 z-[9999]">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 min-w-[200px]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-700">
                {selectedCells.size} célula(s) selecionada(s)
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedCells(new Set())}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedCells(new Set())}
                className="flex-1 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={confirmSelectionAction}
                disabled={modo === 'alocacao' && !selectedDentista}
                className={`flex-1 text-xs ${
                  modo === 'alocacao' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <Check className="h-3 w-3 mr-1" />
                Aplicar
              </Button>
            </div>
            {modo === 'alocacao' && !selectedDentista && (
              <div className="text-xs text-amber-600 mt-2 text-center">
                Selecione um dentista
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
