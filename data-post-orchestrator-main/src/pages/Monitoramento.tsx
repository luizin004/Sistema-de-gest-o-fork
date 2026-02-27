import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Target, ArrowLeft, Plus, TrendingUp, Users, Calendar, MessageSquare, Edit3, Trash2, RefreshCw, BarChart3, AlertTriangle, CheckCircle, Clock, XCircle, Upload, FileText, ChevronDown, Pause, Play, Download } from "lucide-react";
import { toast } from "sonner";
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useCRMData } from "@/hooks/useCRMData";

const SUPABASE_URL = 'https://itescalcmmhhlzsmgdfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const EDGE_FUNCTION_URL = 'https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/cadastro-campanhas';
const TOGGLE_DISPAROS_URL = 'https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/toggle-disparos';
const METRICAS_URL = 'https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/campanha-metricas';

interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  mensagem_template: string;
  enviar_audio_vazio?: boolean;
  data_inicio: string;
  data_fim: string;
  status: 'ativa' | 'pausada' | 'finalizada';
  total_leads: number;
  disparos_feitos: number;
  disparos_pendentes: number;
  falharam: number;
  responderam: number;
  nao_responderam: number;
}

interface StatsGerais {
  total_leads: number;
  disparos_feitos: number;
  disparos_pendentes: number;
  falharam: number;
  responderam: number;
  nao_responderam: number;
  campanhas_ativas: number;
  campanhas_total: number;
}

const Monitoramento = () => {
  const { tenantId } = useCRMData();
  const [todaysHumanMessages, setTodaysHumanMessages] = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Novas métricas
  const [metrics, setMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  
  // Métrica de confirmações
  const [confirmationMessages, setConfirmationMessages] = useState(0);
  const [loadingConfirmations, setLoadingConfirmations] = useState(false);
  
  // Seletor de período para relatórios
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loadingReport, setLoadingReport] = useState(false);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  // Função para gerar relatório por período (linhas = dias, colunas = métricas)
  const generatePeriodReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      console.log('Gerando relatório período:', startDate.toISOString().split('T')[0], 'até', endDate.toISOString().split('T')[0]);
      
      // Garantir que endDate inclua o dia completo
      const endOfPeriod = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);
      
      // Buscar todas as mensagens do período
      const { data: allMessages, error: messagesError } = await supabase
        .from('uazapi_chat_messages')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('direction', 'outbound')
        .eq('metadata->>wasSentByApi', 'false')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endOfPeriod.toISOString())
        .order('created_at', { ascending: true });
      
      if (messagesError) {
        console.error('Erro ao buscar mensagens para relatório:', messagesError);
        toast.error('Erro ao gerar relatório');
        return;
      }
      
      // Buscar métricas detalhadas do período
      const { data: detailedMetrics, error: metricsError } = await supabase
        .from('employee_metrics')
        .select('*')
        .gte('metric_date', startDate.toISOString().split('T')[0])
        .lte('metric_date', endDate.toISOString().split('T')[0])
        .order('metric_date, employee_source');
      
      if (metricsError) {
        console.error('Erro ao buscar métricas detalhadas:', metricsError);
      }
      
      // Agrupar mensagens por dia (ajustando fuso horário corretamente)
      const messagesByDay = new Map();
      
      allMessages?.forEach(msg => {
        // Converter UTC para horário local (America/Sao_Paulo)
        const utcDate = new Date(msg.created_at);
        // Ajustar para fuso horário Brasil (UTC-3)
        const localDate = new Date(utcDate.getTime() - (3 * 60 * 60 * 1000));
        const day = localDate.toISOString().split('T')[0];
        if (!messagesByDay.has(day)) {
          messagesByDay.set(day, []);
        }
        messagesByDay.get(day).push(msg);
      });
      
      // Gerar linhas do relatório (cada linha = um dia)
      const reportRows = [];
      
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dayStr = date.toISOString().split('T')[0];
        const dayMessages = messagesByDay.get(dayStr) || [];
        
        // Calcular métricas do dia
        const totalMessages = dayMessages.length;
        const confirmationMessages = dayMessages.filter(msg => 
          msg.content?.includes('passando pra lembrar') ||
          msg.content?.includes('horário com') ||
          msg.content?.includes('clínica odontomanager') ||
          msg.content?.includes('confirmar?') ||
          msg.content?.includes('especialmente para você') ||
          msg.content?.includes('tolerância:') ||
          msg.content?.includes('brackets% solta')
        ).length;
        
        const emojiMessages = dayMessages.filter(msg => 
          ['❤️', '👍', '👎', '😊', '😂', '🎉', '🔥', '✅', '❌', '👏', '🙏', '💪', '🎯', '⭐', '✨', '🌟', '💯', '🚀', '💎'].includes(msg.content)
        ).length;
        
        const emptyMessages = dayMessages.filter(msg => 
          !msg.content || msg.content.trim() === ''
        ).length;
        
        const realMessages = totalMessages - confirmationMessages - emojiMessages - emptyMessages;
        
        // Contar por fonte
        const androidMessages = dayMessages.filter(m => m.metadata?.source === 'android').length;
        const webMessages = dayMessages.filter(m => m.metadata?.source === 'web').length;
        const crmMessages = dayMessages.filter(m => m.metadata?.source === 'crm').length;
        
        // Buscar métricas detalhadas do dia
        const dayMetrics = detailedMetrics?.filter(m => m.metric_date === dayStr) || [];
        
        // Calcular métricas detalhadas
        let avgIdleTime = 0;
        let messagesPerHour = 0;
        let workDuration = 0;
        let peakHour = '';
        
        if (dayMetrics.length > 0) {
          const totalIdle = dayMetrics.reduce((sum, m) => sum + (m.avg_idle_time_seconds || 0), 0);
          const totalMsgPerHour = dayMetrics.reduce((sum, m) => sum + (m.messages_per_hour || 0), 0);
          const totalWorkDuration = dayMetrics.reduce((sum, m) => sum + (m.work_duration_seconds || 0), 0);
          
          avgIdleTime = dayMetrics.length > 0 ? totalIdle / dayMetrics.length : 0;
          messagesPerHour = totalMsgPerHour;
          workDuration = totalWorkDuration;
          
          // Encontrar hora de pico
          const peakHourMetric = dayMetrics.find(m => m.peak_hour);
          peakHour = peakHourMetric?.peak_hour || '';
        }
        
        // Calcular duração do trabalho a partir das mensagens se não houver métricas
        if (workDuration === 0 && dayMessages.length > 1) {
          const firstMessage = new Date(dayMessages[0].created_at);
          const lastMessage = new Date(dayMessages[dayMessages.length - 1].created_at);
          workDuration = (lastMessage.getTime() - firstMessage.getTime()) / 1000; // em segundos
        }
        
        // Formatar tempo em horas
        const formatHours = (seconds: number) => {
          if (seconds === 0) return '0h 0m';
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          return `${hours}h ${minutes}m`;
        };
        
        // Criar linha do relatório
        const row = {
          'Data': new Date(dayStr).toLocaleDateString('pt-BR'),
          'Total Mensagens': totalMessages,
          'Mensagens Reais': realMessages,
          'Confirmações': confirmationMessages,
          'Emojis': emojiMessages,
          'Vazias': emptyMessages,
          'Android': androidMessages,
          'Web': webMessages,
          'CRM': crmMessages,
          'Tempo Ocioso Médio': formatHours(avgIdleTime),
          'Mensagens por Hora': Math.round(messagesPerHour * 10) / 10,
          'Duração Trabalho': formatHours(workDuration),
          'Hora de Pico': peakHour
        };
        
        reportRows.push(row);
      }
      
      // Criar workbook do Excel
      const wb = XLSX.utils.book_new();
      
      // Planilha de Explicação das Métricas
      const explicacoes = [
        {
          'Métrica': 'Total Mensagens',
          'Descrição': 'Número total de mensagens enviadas pelos funcionários',
          'Critérios': 'Mensagens outbound (enviadas) por funcionários (wasSentByApi = false)',
          'Filtros': 'Exclui mensagens automáticas do bot',
          'Interpretação': 'Volume geral de comunicação com clientes'
        },
        {
          'Métrica': 'Mensagens Reais',
          'Descrição': 'Mensagens genuínas de conversação com clientes',
          'Critérios': 'Exclui confirmações, emojis e respostas rápidas (< 30s)',
          'Filtros': 'Remove lembretes de horário, emojis isolados, mensagens vazias',
          'Interpretação': 'Interações reais e significativas com clientes'
        },
        {
          'Métrica': 'Confirmações',
          'Descrição': 'Mensagens automáticas de lembrete de horário',
          'Critérios': 'Contém padrões específicos de confirmação',
          'Filtros': '"passando pra lembrar", "horário com", "clínica odontomanager", etc.',
          'Interpretação': 'Comunicação operacional de agendamentos'
        },
        {
          'Métrica': 'Emojis',
          'Descrição': 'Mensagens que contêm apenas emojis',
          'Critérios': 'Conteúdo é exatamente um emoji da lista',
          'Filtros': '❤️, 👍, 👎, 😊, 😂, 🎉, 🔥, ✅, ❌, 👏, 🙏, 💪, 🎯, ⭐, ✨, 🌟, 💯, 🚀, 💎',
          'Interpretação': 'Respostas rápidas ou reações emocionais'
        },
        {
          'Métrica': 'Vazias',
          'Descrição': 'Mensagens sem conteúdo textual',
          'Critérios': 'Conteúdo nulo, undefined ou string vazia',
          'Filtros': 'content IS NULL ou content = ""',
          'Interpretação': 'Possíveis erros de sistema ou testes'
        },
        {
          'Métrica': 'Tempo Ocioso Médio',
          'Descrição': 'Intervalo médio entre mensagens consecutivas do mesmo funcionário',
          'Critérios': 'Apenas intervalos ≥ 30s e ≤ 4h entre mensagens reais',
          'Filtros': 'Exclui respostas rápidas (< 30s) e longas pausas (> 4h)',
          'Interpretação': 'Ritmo real de trabalho entre conversas diferentes'
        },
        {
          'Métrica': 'Mensagens por Hora',
          'Descrição': 'Frequência de mensagens enviadas por hora de trabalho',
          'Critérios': 'Total de mensagens ÷ duração do trabalho em horas',
          'Filtros': 'Baseado na primeira e última mensagem do dia',
          'Interpretação': 'Produtividade e eficiência do funcionário'
        },
        {
          'Métrica': 'Duração Trabalho',
          'Descrição': 'Período total de atividade do funcionário',
          'Critérios': 'Diferença entre primeira e última mensagem do dia',
          'Filtros': 'Considera apenas dias com mensagens',
          'Interpretação': 'Jornada de trabalho efetiva'
        },
        {
          'Métrica': 'Hora de Pico',
          'Descrição': 'Horário com maior volume de mensagens',
          'Critérios': 'Hora com maior contagem de mensagens enviadas',
          'Filtros': 'Baseado em todas as mensagens do dia',
          'Interpretação': 'Período de maior demanda ou produtividade'
        },
        {
          'Métrica': 'Android/Web/CRM',
          'Descrição': 'Distribuição de mensagens por plataforma de origem',
          'Critérios': 'metadata->>source = "android" | "web" | "crm"',
          'Filtros': 'Apenas mensagens de funcionários',
          'Interpretação': 'Preferência de plataforma e distribuição de trabalho'
        }
      ];
      
      const wsExplicacoes = XLSX.utils.json_to_sheet(explicacoes);
      XLSX.utils.book_append_sheet(wb, wsExplicacoes, 'Guia de Métricas');
      
      // Planilha de Resumo Executivo com Insights
      const totalPeriodDays = reportRows.length;
      const totalMessages = reportRows.reduce((sum, row) => sum + (row['Total Mensagens'] || 0), 0);
      const totalRealMessages = reportRows.reduce((sum, row) => sum + (row['Mensagens Reais'] || 0), 0);
      const totalConfirmations = reportRows.reduce((sum, row) => sum + (row['Confirmações'] || 0), 0);
      const avgMessagesPerDay = totalPeriodDays > 0 ? Math.round(totalMessages / totalPeriodDays) : 0;
      const confirmationRate = totalMessages > 0 ? Math.round((totalConfirmations / totalMessages) * 100) : 0;
      
      // Encontrar dia mais produtivo e menos produtivo
      const mostProductiveDay = reportRows.reduce((max, row) => 
        (row['Mensagens Reais'] || 0) > (max['Mensagens Reais'] || 0) ? row : max, reportRows[0] || {});
      const leastProductiveDay = reportRows.reduce((min, row) => 
        (row['Mensagens Reais'] || 0) < (min['Mensagens Reais'] || 0) ? row : min, reportRows[0] || {});
      
      // Análise de plataformas
      const totalAndroid = reportRows.reduce((sum, row) => sum + (row['Android'] || 0), 0);
      const totalWeb = reportRows.reduce((sum, row) => sum + (row['Web'] || 0), 0);
      const totalCRM = reportRows.reduce((sum, row) => sum + (row['CRM'] || 0), 0);
      
      const insights = [
        {
          'Indicador': 'Período Analisado',
          'Valor': `${totalPeriodDays} dias`,
          'Insight': 'Período total de monitoramento',
          'Recomendação': totalPeriodDays < 7 ? 'Considere analisar um período maior para tendências mais consistentes' : 'Período adequado para análise'
        },
        {
          'Indicador': 'Volume Total',
          'Valor': `${totalMessages} mensagens`,
          'Insight': `Média de ${avgMessagesPerDay} mensagens por dia`,
          'Recomendação': avgMessagesPerDay < 10 ? 'Baixo volume - verifique se há problemas operacionais' : 'Volume normal de operação'
        },
        {
          'Indicador': 'Taxa de Confirmação',
          'Valor': `${confirmationRate}%`,
          'Insight': 'Proporção de mensagens automáticas vs manuais',
          'Recomendação': confirmationRate > 50 ? 'Alta automação - bom para eficiência' : 'Espaço para otimizar processos automáticos'
        },
        {
          'Indicador': 'Engajamento Real',
          'Valor': `${Math.round((totalRealMessages / totalMessages) * 100)}%`,
          'Insight': 'Proporção de conversas genuínas',
          'Recomendação': 'Mantenha o foco em interações significativas com clientes'
        },
        {
          'Indicador': 'Dia Mais Produtivo',
          'Valor': mostProductiveDay['Data'] || 'N/A',
          'Insight': `${mostProductiveDay['Mensagens Reais'] || 0} mensagens reais`,
          'Recomendação': 'Analise os fatores que contribuíram para este desempenho'
        },
        {
          'Indicador': 'Dia Menos Produtivo',
          'Valor': leastProductiveDay['Data'] || 'N/A',
          'Insight': `${leastProductiveDay['Mensagens Reais'] || 0} mensagens reais`,
          'Recomendação': 'Investigue possíveis causas (feriados, problemas técnicos, etc.)'
        },
        {
          'Indicador': 'Plataforma Principal',
          'Valor': totalAndroid >= totalWeb && totalAndroid >= totalCRM ? 'Android' : 
                   totalWeb >= totalCRM ? 'Web' : 'CRM',
          'Insight': `Android: ${totalAndroid}, Web: ${totalWeb}, CRM: ${totalCRM}`,
          'Recomendação': 'Otimize processos para a plataforma mais utilizada'
        },
        {
          'Indicador': 'Qualidade dos Dados',
          'Valor': 'Monitorada',
          'Insight': 'Filtros aplicados para excluir automáticas e irrelevantes',
          'Recomendação': 'Revise periodicamente os filtros para manter precisão'
        }
      ];
      
      const wsInsights = XLSX.utils.json_to_sheet(insights);
      XLSX.utils.book_append_sheet(wb, wsInsights, 'Resumo Executivo');
      
      // Planilha de Resumo (linhas = dias, colunas = métricas)
      const wsResumo = XLSX.utils.json_to_sheet(reportRows);
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por Dia');
      
      // Planilha de Métricas Detalhadas
      if (detailedMetrics && detailedMetrics.length > 0) {
        const wsMetrics = XLSX.utils.json_to_sheet(detailedMetrics);
        XLSX.utils.book_append_sheet(wb, wsMetrics, 'Métricas Detalhadas');
      }
      
      // Planilha de Mensagens Detalhadas (opcional - se não for muito grande)
      if (allMessages && allMessages.length <= 1000) {
        const wsMensagens = XLSX.utils.json_to_sheet(allMessages.map(msg => {
          // Converter UTC para horário local (America/Sao_Paulo)
          const utcDate = new Date(msg.created_at);
          const localDate = new Date(utcDate.getTime() - (3 * 60 * 60 * 1000));
          
          return {
            'Data': localDate.toLocaleDateString('pt-BR'),
            'Horário': localDate.toLocaleTimeString('pt-BR'),
            'Fonte': msg.metadata?.source || 'N/A',
            'Conteúdo': msg.content || '',
            'Tipo': msg.content?.includes('passando pra lembrar') ? 'Confirmação' : 
                  ['❤️', '👍', '👎', '😊', '😂', '🎉', '🔥', '✅', '❌', '👏', '🙏', '💪', '🎯', '⭐', '✨', '🌟', '💯', '🚀', '💎'].includes(msg.content) ? 'Emoji' : 
                  (!msg.content || msg.content.trim() === '') ? 'Vazia' : 'Real'
          };
        }));
        XLSX.utils.book_append_sheet(wb, wsMensagens, 'Mensagens Detalhadas');
      }
      
      // Gerar e baixar arquivo
      const fileName = `relatorio_monitoramento_${startDate.toISOString().split('T')[0]}_ate_${endDate.toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success(`Relatório completo gerado! ${reportRows.length} dias analisados com 5 planilhas: Guia de Métricas, Resumo Executivo, Resumo por Dia, Métricas Detalhadas e Mensagens Detalhadas.`);
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setLoadingReport(false);
    }
  }, [startDate, endDate]);

  // Função para buscar dados horários para o gráfico
  const fetchHourlyData = useCallback(async () => {
    setLoadingChart(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      console.log('Buscando dados horários de:', startOfDay.toISOString(), 'até', endOfDay.toISOString());
      
      // Buscar todas as mensagens do dia
      const { data: messages, error } = await supabase
        .from('uazapi_chat_messages')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString())
        .eq('direction', 'outbound')
        .eq('metadata->>wasSentByApi', 'false');

      if (error) {
        console.error('Erro ao buscar mensagens para gráfico:', error);
        toast.error('Erro ao buscar dados para o gráfico');
        return;
      }

      if (!messages || messages.length === 0) {
        console.log('Nenhuma mensagem encontrada para o gráfico');
        setHourlyData([]);
        return;
      }

      // Agrupar mensagens por hora
      const hourlyCounts: { [key: string]: number } = {};
      
      // Inicializar todas as horas do dia (0-23) com zero
      for (let hour = 0; hour < 24; hour++) {
        hourlyCounts[hour] = 0;
      }

      // Contar mensagens por hora
      messages.forEach(msg => {
        const hour = new Date(msg.created_at).getHours();
        hourlyCounts[hour]++;
      });

      // Converter para formato do gráfico
      const chartData = Object.entries(hourlyCounts).map(([hour, count]) => ({
        hour: `${hour}:00`,
        messages: count,
        hourNumber: parseInt(hour)
      }));

      console.log('Dados horários processados:', chartData);
      setHourlyData(chartData);
      
    } catch (error) {
      console.error('Erro ao buscar dados horários:', error);
      toast.error('Erro ao buscar dados para o gráfico');
    } finally {
      setLoadingChart(false);
    }
  }, []);

  // Função para gerar relatório em PDF completo
  const generatePDFReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      // Buscar dados para o relatório
      const { data: allMessages, error: messagesError } = await supabase
        .from('uazapi_chat_messages')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('direction', 'outbound')
        .eq('metadata->>wasSentByApi', 'false');

      if (messagesError) throw messagesError;

      // Buscar métricas detalhadas
      const { data: detailedMetrics } = await supabase
        .from('employee_metrics')
        .select('*')
        .gte('metric_date', startDate.toISOString().split('T')[0])
        .lte('metric_date', endDate.toISOString().split('T')[0]);

      // Calcular métricas para o período
      const reportData = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayStr = currentDate.toISOString().split('T')[0];
        const dayMessages = allMessages?.filter(msg => 
          msg.created_at.startsWith(dayStr)
        ) || [];

        // Calcular métricas do dia
        const realMessages = dayMessages.filter(msg => {
          const content = msg.content || '';
          const isConfirmation = content.includes('passando pra lembrar') ||
                                content.includes('horário com') ||
                                content.includes('clínica odontomanager') ||
                                content.includes('confirmar?') ||
                                content.includes('Obrigado por confirmar') ||
                                content.includes('Gostaríamos de lembrar');
          const isEmoji = ['❤️', '👍', '👎', '😊', '😂', '🎉', '🔥', '✅', '❌', '👏', '🙏', '💪', '🎯', '⭐', '✨', '🌟', '💯', '🚀', '💎'].includes(content);
          const isEmpty = !content || content.trim() === '';
          
          return !isConfirmation && !isEmoji && !isEmpty;
        });

        const confirmationMessages = dayMessages.filter(msg => {
          const content = msg.content || '';
          return content.includes('passando pra lembrar') ||
                 content.includes('horário com') ||
                 content.includes('clínica odontomanager') ||
                 content.includes('confirmar?') ||
                 content.includes('Obrigado por confirmar') ||
                 content.includes('Gostaríamos de lembrar');
        });

        const emojiMessages = dayMessages.filter(msg => {
          const content = msg.content || '';
          return ['❤️', '👍', '👎', '😊', '😂', '🎉', '🔥', '✅', '❌', '👏', '🙏', '💪', '🎯', '⭐', '✨', '🌟', '💯', '🚀', '💎'].includes(content);
        });

        const emptyMessages = dayMessages.filter(msg => {
          const content = msg.content || '';
          return !content || content.trim() === '';
        });

        const androidMessages = dayMessages.filter(m => m.metadata?.source === 'android').length;
        const webMessages = dayMessages.filter(m => m.metadata?.source === 'web').length;
        const crmMessages = dayMessages.filter(m => m.metadata?.source === 'crm').length;

        // Calcular tempo ocioso e outras métricas
        let avgIdleTime = 0;
        let messagesPerHour = 0;
        let workDuration = 0;
        let peakHour = '';
        
        const dayMetrics = detailedMetrics?.filter(m => m.metric_date === dayStr) || [];
        
        if (dayMetrics.length > 0) {
          const totalIdle = dayMetrics.reduce((sum, m) => sum + (m.avg_idle_time_seconds || 0), 0);
          const totalMsgPerHour = dayMetrics.reduce((sum, m) => sum + (m.messages_per_hour || 0), 0);
          const totalWorkDuration = dayMetrics.reduce((sum, m) => sum + (m.work_duration_seconds || 0), 0);
          
          avgIdleTime = dayMetrics.length > 0 ? totalIdle / dayMetrics.length : 0;
          messagesPerHour = totalMsgPerHour;
          workDuration = totalWorkDuration;
          
          const peakHourMetric = dayMetrics.find(m => m.peak_hour);
          peakHour = peakHourMetric?.peak_hour?.toString() || '';
        }

        // Calcular duração do trabalho a partir das mensagens se não houver métricas
        if (workDuration === 0 && dayMessages.length > 1) {
          const firstMessage = new Date(dayMessages[0].created_at);
          const lastMessage = new Date(dayMessages[dayMessages.length - 1].created_at);
          workDuration = (lastMessage.getTime() - firstMessage.getTime()) / 1000;
        }

        // Formatar tempo em horas
        const formatHours = (seconds: number) => {
          if (seconds === 0) return '0h 0m';
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          return `${hours}h ${minutes}m`;
        };

        reportData.push({
          date: new Date(dayStr).toLocaleDateString('pt-BR'),
          total: dayMessages.length,
          real: realMessages.length,
          confirmations: confirmationMessages.length,
          emojis: emojiMessages.length,
          empty: emptyMessages.length,
          android: androidMessages,
          web: webMessages,
          crm: crmMessages,
          avgIdleTime: formatHours(avgIdleTime),
          messagesPerHour: Math.round(messagesPerHour * 10) / 10,
          workDuration: formatHours(workDuration),
          peakHour: peakHour
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calcular distribuição horária para o período (0-23)
      const hourlyCounts: { [key: number]: number } = {};
      for (let hour = 0; hour < 24; hour++) hourlyCounts[hour] = 0;

      (allMessages || []).forEach((msg: any) => {
        const hour = new Date(msg.created_at).getHours();
        if (hour >= 0 && hour <= 23) hourlyCounts[hour] += 1;
      });

      const hourlyPeriodData = Object.entries(hourlyCounts).map(([hour, count]) => ({
        hour: `${hour}:00`,
        messages: count,
        hourNumber: parseInt(hour, 10),
      }));

      // Criar PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Função auxiliar para adicionar nova página se necessário
      const checkPageBreak = (yPos: number, margin: number = 30) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          return 30;
        }
        return yPos;
      };
      
      // Página 1 - Cabeçalho
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Relatório Completo de Monitoramento', pageWidth / 2, 30, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Período: ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`, pageWidth / 2, 45, { align: 'center' });
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 55, { align: 'center' });
      
      // Resumo executivo
      const totalMessages = reportData.reduce((sum, day) => sum + day.total, 0);
      const totalReal = reportData.reduce((sum, day) => sum + day.real, 0);
      const totalConfirmations = reportData.reduce((sum, day) => sum + day.confirmations, 0);
      const totalEmojis = reportData.reduce((sum, day) => sum + day.emojis, 0);
      const totalEmpty = reportData.reduce((sum, day) => sum + day.empty, 0);
      const avgPerDay = Math.round(totalMessages / reportData.length);
      const confirmationRate = totalMessages > 0 ? Math.round((totalConfirmations / totalMessages) * 100) : 0;
      const realRate = totalMessages > 0 ? Math.round((totalReal / totalMessages) * 100) : 0;
      
      // Encontrar dia mais produtivo
      const mostProductiveDay = reportData.reduce((max, day) => day.real > max.real ? day : max, reportData[0] || {});
      const leastProductiveDay = reportData.reduce((min, day) => day.real < min.real ? day : min, reportData[0] || {});
      
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resumo Executivo', 20, 75);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      let yPos = 90;
      
      pdf.text(`Período Analisado: ${reportData.length} dias`, 20, yPos);
      yPos += 10;
      pdf.text(`Volume Total: ${totalMessages} mensagens (${avgPerDay} por dia)`, 20, yPos);
      yPos += 10;
      pdf.text(`Taxa de Confirmação: ${confirmationRate}% (${totalConfirmations} mensagens)`, 20, yPos);
      yPos += 10;
      pdf.text(`Engajamento Real: ${realRate}% (${totalReal} mensagens)`, 20, yPos);
      yPos += 10;
      pdf.text(`Dia Mais Produtivo: ${mostProductiveDay.date} (${mostProductiveDay.real} mensagens reais)`, 20, yPos);
      yPos += 10;
      pdf.text(`Dia Menos Produtivo: ${leastProductiveDay.date} (${leastProductiveDay.real} mensagens reais)`, 20, yPos);
      
      // Página 2 - Gráfico de Mensagens por Hora (período)
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Mensagens por Hora do Dia', 20, 30);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Distribuição das mensagens enviadas ao longo das 24 horas (somado no período)', 20, 45);
      
      const peakHourPeriod = hourlyPeriodData.reduce(
        (max, hour) => (hour.messages > max.messages ? hour : max),
        hourlyPeriodData[0]
      );
      const totalHourlyMessages = hourlyPeriodData.reduce((sum, hour) => sum + hour.messages, 0);
      const activeHours = hourlyPeriodData.filter(hour => hour.messages > 0).length;
      
      yPos = 65;
      pdf.text(`Total de Mensagens (por hora): ${totalHourlyMessages}`, 20, yPos);
      yPos += 10;
      pdf.text(`Hora de Pico: ${peakHourPeriod.hour} (${peakHourPeriod.messages} mensagens)`, 20, yPos);
      yPos += 10;
      pdf.text(`Horas Ativas: ${activeHours} de 24`, 20, yPos);
      yPos += 15;
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Tabela Horária', 20, yPos);
      yPos += 12;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Hora', 20, yPos);
      pdf.text('Mensagens', 60, yPos);
      pdf.text('%', 100, yPos);
      pdf.line(20, yPos + 2, pageWidth - 20, yPos + 2);
      yPos += 8;
      
      pdf.setFont('helvetica', 'normal');
      hourlyPeriodData.forEach((hourData) => {
        yPos = checkPageBreak(yPos, 15);
        const percentage = totalHourlyMessages > 0 ? Math.round((hourData.messages / totalHourlyMessages) * 100) : 0;
        pdf.text(hourData.hour, 20, yPos);
        pdf.text(hourData.messages.toString(), 60, yPos);
        pdf.text(`${percentage}%`, 100, yPos);
        yPos += 7;
      });
      
      // Página 3 - Tabela de Dados Diários
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Dados Diários Completos', 20, 30);
      
      // Cabeçalho da tabela
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      yPos = 50;
      
      const headers = ['Data', 'Total', 'Reais', 'Conf.', 'Emojis', 'Vazias', 'Android', 'Web', 'CRM', 'Ocioso', 'Msgs/H', 'Trabalho', 'Pico'];
      const colPositions = [20, 40, 55, 70, 85, 100, 115, 130, 145, 160, 175, 190, 205];
      
      headers.forEach((header, index) => {
        pdf.text(header, colPositions[index], yPos);
      });
      
      // Linha separadora
      pdf.line(20, yPos + 3, pageWidth - 20, yPos + 3);
      yPos += 8;
      
      // Dados da tabela
      pdf.setFont('helvetica', 'normal');
      
      reportData.forEach((day) => {
        yPos = checkPageBreak(yPos, 15);
        
        pdf.text(day.date, colPositions[0], yPos);
        pdf.text(day.total.toString(), colPositions[1], yPos);
        pdf.text(day.real.toString(), colPositions[2], yPos);
        pdf.text(day.confirmations.toString(), colPositions[3], yPos);
        pdf.text(day.emojis.toString(), colPositions[4], yPos);
        pdf.text(day.empty.toString(), colPositions[5], yPos);
        pdf.text(day.android.toString(), colPositions[6], yPos);
        pdf.text(day.web.toString(), colPositions[7], yPos);
        pdf.text(day.crm.toString(), colPositions[8], yPos);
        pdf.text(day.avgIdleTime, colPositions[9], yPos);
        pdf.text(day.messagesPerHour.toString(), colPositions[10], yPos);
        pdf.text(day.workDuration, colPositions[11], yPos);
        pdf.text(day.peakHour + 'h', colPositions[12], yPos);
        
        yPos += 8;
      });
      
      // Página 4 - Análise por Plataforma
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Análise Detalhada por Plataforma', 20, 30);
      
      const totalAndroid = reportData.reduce((sum, day) => sum + day.android, 0);
      const totalWeb = reportData.reduce((sum, day) => sum + day.web, 0);
      const totalCRM = reportData.reduce((sum, day) => sum + day.crm, 0);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      yPos = 50;
      
      pdf.text(`Android: ${totalAndroid} mensagens (${Math.round((totalAndroid/totalMessages)*100)}%)`, 20, yPos);
      yPos += 10;
      pdf.text(`Web: ${totalWeb} mensagens (${Math.round((totalWeb/totalMessages)*100)}%)`, 20, yPos);
      yPos += 10;
      pdf.text(`CRM: ${totalCRM} mensagens (${Math.round((totalCRM/totalMessages)*100)}%)`, 20, yPos);
      yPos += 20;
      
      // Análise qualitativa
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Insights e Recomendações', 20, yPos);
      yPos += 15;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const insights = [
        `• Volume de Operação: ${avgPerDay < 10 ? 'Baixo - verificar possíveis problemas operacionais' : 'Adequado para operação normal'}`,
        `• Automação: ${confirmationRate > 50 ? 'Alta taxa de automação - bom para eficiência' : 'Espaço para otimizar processos automáticos'}`,
        `• Engajamento: ${realRate > 70 ? 'Alto engajamento real - ótima interação com clientes' : 'Focar em melhorar qualidade das interações'}`,
        `• Plataforma Principal: ${totalAndroid >= totalWeb && totalAndroid >= totalCRM ? 'Android - otimizar processos mobile' : totalWeb >= totalCRM ? 'Web - otimizar interface web' : 'CRM - revisar processos internos'}`,
        `• Qualidade de Dados: Filtros aplicados para garantir precisão nas métricas`,
        `• Período Analisado: ${reportData.length < 7 ? 'Curto - considerar análise mais longa para tendências' : 'Adequado para identificar padrões'}`
      ];
      
      insights.forEach(insight => {
        yPos = checkPageBreak(yPos, 15);
        pdf.text(insight, 20, yPos);
        yPos += 12;
      });
      
      // Página 5 - Guia de Métricas
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Guia de Métricas', 20, 30);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      yPos = 45;
      
      const metrics = [
        {
          name: 'Total Mensagens',
          desc: 'Número total de mensagens enviadas pelos funcionários',
          criteria: 'Mensagens outbound (enviadas) por funcionários (wasSentByApi = false)',
          filters: 'Exclui mensagens automáticas do bot',
          interpretation: 'Volume geral de comunicação com clientes'
        },
        {
          name: 'Mensagens Reais',
          desc: 'Mensagens genuínas de conversação com clientes',
          criteria: 'Exclui confirmações, emojis e respostas rápidas (< 30s)',
          filters: 'Remove lembretes de horário, emojis isolados, mensagens vazias',
          interpretation: 'Interações reais e significativas com clientes'
        },
        {
          name: 'Confirmações',
          desc: 'Mensagens automáticas de lembrete de horário',
          criteria: 'Contém padrões específicos de confirmação',
          filters: '"passando pra lembrar", "horário com", "clínica odontomanager", etc.',
          interpretation: 'Comunicação operacional de agendamentos'
        },
        {
          name: 'Emojis',
          desc: 'Mensagens que contêm apenas emojis',
          criteria: 'Conteúdo é exatamente um emoji da lista',
          filters: '❤️, 👍, 👎, 😊, 😂, 🎉, 🔥, ✅, ❌, 👏, 🙏, 💪, 🎯, ⭐, ✨, 🌟, 💯, 🚀, 💎',
          interpretation: 'Respostas rápidas ou reações emocionais'
        },
        {
          name: 'Vazias',
          desc: 'Mensagens sem conteúdo textual',
          criteria: 'Conteúdo nulo, undefined ou string vazia',
          filters: 'content IS NULL ou content = ""',
          interpretation: 'Possíveis erros de sistema ou testes'
        },
        {
          name: 'Tempo Ocioso Médio',
          desc: 'Intervalo médio entre mensagens consecutivas do mesmo funcionário',
          criteria: 'Apenas intervalos ≥ 30s e ≤ 4h entre mensagens reais',
          filters: 'Exclui respostas rápidas (< 30s) e longas pausas (> 4h)',
          interpretation: 'Ritmo real de trabalho entre conversas diferentes'
        },
        {
          name: 'Mensagens por Hora',
          desc: 'Frequência de mensagens enviadas por hora de trabalho',
          criteria: 'Total de mensagens ÷ duração do trabalho em horas',
          filters: 'Baseado na primeira e última mensagem do dia',
          interpretation: 'Produtividade e eficiência do funcionário'
        },
        {
          name: 'Duração Trabalho',
          desc: 'Período total de atividade do funcionário',
          criteria: 'Diferença entre primeira e última mensagem do dia',
          filters: 'Considera apenas dias com mensagens',
          interpretation: 'Jornada de trabalho efetiva'
        },
        {
          name: 'Hora de Pico',
          desc: 'Horário com maior volume de mensagens',
          criteria: 'Hora com maior contagem de mensagens enviadas',
          filters: 'Baseado em todas as mensagens do dia',
          interpretation: 'Período de maior demanda ou produtividade'
        },
        {
          name: 'Android/Web/CRM',
          desc: 'Distribuição de mensagens por plataforma de origem',
          criteria: 'metadata->>source = "android" | "web" | "crm"',
          filters: 'Apenas mensagens de funcionários',
          interpretation: 'Preferência de plataforma e distribuição de trabalho'
        }
      ];
      
      metrics.forEach((metric, index) => {
        yPos = checkPageBreak(yPos, 40);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${index + 1}. ${metric.name}`, 20, yPos);
        yPos += 8;
        
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Descrição: ${metric.desc}`, 25, yPos);
        yPos += 6;
        pdf.text(`Critérios: ${metric.criteria}`, 25, yPos);
        yPos += 6;
        pdf.text(`Filtros: ${metric.filters}`, 25, yPos);
        yPos += 6;
        pdf.text(`Interpretação: ${metric.interpretation}`, 25, yPos);
        yPos += 12;
      });
      
      // Página 6 - Metodologia Completa
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Metodologia e Critérios Técnicos', 20, 30);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      yPos = 50;
      
      const methodology = [
        'FILTROS APLICADOS:',
        '• Excluir mensagens automáticas do bot (wasSentByApi = true)',
        '• Considerar apenas mensagens outbound (enviadas)',
        '• Excluir mensagens de confirmação de horário:',
        '  - "passando pra lembrar"',
        '  - "horário com"',
        '  - "clínica odontomanager"',
        '  - "confirmar?"',
        '  - "especialmente para você"',
        '  - "tolerância:"',
        '  - "brackets% solta"',
        '  - "Obrigado por confirmar seu horário"',
        '  - "Gostaríamos de lembrar"',
        '• Excluir emojis isolados: ❤️, 👍, 👎, 😊, 😂, 🎉, 🔥, ✅, ❌, 👏, 🙏, 💪, 🎯, ⭐, ✨, 🌟, 💯, 🚀, 💎',
        '• Excluir mensagens vazias (content IS NULL ou content = "")',
        '',
        'CÁLCULOS DE MÉTRICAS:',
        '• Tempo Ocioso Médio: Média de intervalos ≥ 30s e ≤ 4h entre mensagens consecutivas',
        '• Mensagens por Hora: Total de mensagens ÷ duração do trabalho em horas',
        '• Duração do Trabalho: Diferença entre primeira e última mensagem do dia',
        '• Hora de Pico: Hora com maior contagem de mensagens enviadas',
        '• Distribuição por Plataforma: Baseado em metadata->>source',
        '',
        'PERÍODO E FUSO HORÁRIO:',
        '• Período: Dias selecionados pelo usuário',
        '• Fuso Horário: UTC-3 (America/Sao_Paulo)',
        '• Atualização: Dados em tempo real do banco de dados',
        '',
        'QUALIDADE E PRECISÃO:',
        '• Validação cruzada de múltiplas fontes',
        '• Filtros validados com amostras reais',
        '• Revisão periódica dos critérios de exclusão',
        '• Monitoramento contínuo da qualidade dos dados'
      ];
      
      methodology.forEach(line => {
        yPos = checkPageBreak(yPos, 15);
        pdf.text(line, 20, yPos);
        yPos += 8;
      });
      
      // Página 6 - Gráfico de Barras
      if (hourlyData && hourlyData.length > 0) {
        pdf.addPage();
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Gráfico de Mensagens por Hora', 20, 30);
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Distribuição das mensagens enviadas ao longo das 24 horas do dia', 20, 45);
        
        // Encontrar hora de pico e estatísticas
        const peakHour = hourlyData.reduce((max, hour) => hour.messages > max.messages ? hour : max, hourlyData[0]);
        const totalHourlyMessages = hourlyData.reduce((sum, hour) => sum + hour.messages, 0);
        const activeHours = hourlyData.filter(hour => hour.messages > 0).length;
        
        yPos = 65;
        pdf.text(`Total de Mensagens: ${totalHourlyMessages}`, 20, yPos);
        yPos += 10;
        pdf.text(`Hora de Pico: ${peakHour.hour} (${peakHour.messages} mensagens)`, 20, yPos);
        yPos += 10;
        pdf.text(`Horas Ativas: ${activeHours} de 24 horas`, 20, yPos);
        yPos += 20;
        
        // Tabela com dados horários
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Dados Horários Detalhados', 20, yPos);
        yPos += 15;
        
        // Cabeçalho da tabela
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Hora', 20, yPos);
        pdf.text('Mensagens', 60, yPos);
        pdf.text('% do Total', 100, yPos);
        pdf.text('Status', 140, yPos);
        
        // Linha separadora
        pdf.line(20, yPos + 3, pageWidth - 20, yPos + 3);
        yPos += 8;
        
        // Dados da tabela
        pdf.setFont('helvetica', 'normal');
        hourlyData.forEach((hourData) => {
          yPos = checkPageBreak(yPos, 15);
          
          const percentage = totalHourlyMessages > 0 ? 
            Math.round((hourData.messages / totalHourlyMessages) * 100) : 0;
          const status = hourData.messages === 0 ? 'Inativo' : 
                        hourData.messages <= 5 ? 'Baixo' : 
                        hourData.messages <= 10 ? 'Médio' : 'Alto';
          
          pdf.text(hourData.hour, 20, yPos);
          pdf.text(hourData.messages.toString(), 60, yPos);
          pdf.text(`${percentage}%`, 100, yPos);
          pdf.text(status, 140, yPos);
          
          yPos += 8;
        });
        
        yPos += 15;
        
        // Insights do gráfico
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Insights do Padrão Horário', 20, yPos);
        yPos += 15;
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        
        const insights = [
          `• Concentração: ${activeHours <= 8 ? 'Focada em poucas horas' : activeHours <= 16 ? 'Distribuída no expediente' : 'Espalhada pelo dia'}`,
          `• Pico de Atividade: ${peakHour.hour} com ${peakHour.messages} mensagens`,
          `• Períodos Ociosos: ${24 - activeHours} horas sem atividade`,
          `• Média por Hora Ativa: ${activeHours > 0 ? Math.round(totalHourlyMessages / activeHours) : 0} mensagens`,
          `• Eficiência: ${activeHours >= 12 ? 'Boa distribuição' : 'Concentrada em períodos específicos'}`
        ];
        
        insights.forEach(insight => {
          yPos = checkPageBreak(yPos, 15);
          pdf.text(insight, 20, yPos);
          yPos += 12;
        });
      }
      
      // Salvar PDF
      const fileName = `relatorio_completo_monitoramento_${startDate.toISOString().split('T')[0]}_ate_${endDate.toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast.success(`Relatório PDF reestruturado gerado! ${reportData.length} dias analisados com 6 páginas no formato executivo.`);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar relatório PDF');
    } finally {
      setLoadingReport(false);
    }
  }, [startDate, endDate]);

  // Função para buscar mensagens de confirmação do dia
  const fetchConfirmationMessages = useCallback(async () => {
    setLoadingConfirmations(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      console.log('Buscando mensagens de confirmação de:', startOfDay.toISOString(), 'até', endOfDay.toISOString());
      
      const { data, error, count } = await supabase
        .from('uazapi_chat_messages')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('direction', 'outbound')
        .eq('metadata->>wasSentByApi', 'false')
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString())
        .or('content.ilike.%passando pra lembrar%,content.ilike.%horário com%,content.ilike.%clínica odontomanager%,content.ilike.%confirmar?%,content.ilike.%especialmente para você%,content.ilike.%tolerância:%,content.ilike.%brackets% solta%');
      
      console.log('Confirmações - Data:', data);
      console.log('Confirmações - Error:', error);
      console.log('Confirmações - Count:', count);
      
      if (error) {
        console.error('Erro na query de confirmações:', error);
        throw error;
      }
      
      const finalCount = count || 0;
      console.log('Contagem de confirmações final:', finalCount);
      
      setConfirmationMessages(finalCount);
      
    } catch (error) {
      console.error('Erro ao buscar contador de confirmações:', error);
      setConfirmationMessages(0);
    } finally {
      setLoadingConfirmations(false);
    }
  }, []);

  // Função para buscar mensagens humanas do dia atual (excluindo confirmações e emojis)
  const fetchTodaysMessageCount = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      console.log('Buscando mensagens de:', startOfDay.toISOString(), 'até', endOfDay.toISOString());
      
      // Lista de emojis para filtrar (como strings escapadas)
      const emojiPatterns = [
        '❤️', '👍', '👎', '😊', '😂', '🎉', '🔥', '✅', '❌', '👏', '🙏', '💪', '🎯', '⭐', '✨', '🌟', '💯', '🚀', '💎'
      ];
      
      // Construir query dinamicamente para evitar problemas de encoding
      let query = supabase
        .from('uazapi_chat_messages')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('direction', 'outbound')
        .eq('metadata->>wasSentByApi', 'false')
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString())
        .not('content', 'ilike', '%passando pra lembrar%')
        .not('content', 'ilike', '%horário com%')
        .not('content', 'ilike', '%clínica odontomanager%')
        .not('content', 'ilike', '%confirmar?%')
        .not('content', 'ilike', '%especialmente para você%')
        .not('content', 'ilike', '%tolerância:%')
        .not('content', 'ilike', '%brackets% solta%')
        .not('content', 'eq', '');
      
      // Adicionar filtros de emojis individualmente
      emojiPatterns.forEach(emoji => {
        query = query.not('content', 'eq', emoji);
      });
      
      const { data, error, count } = await query;
      
      console.log('Data:', data);
      console.log('Error:', error);
      console.log('Count:', count);
      
      if (error) {
        console.error('Erro na query Supabase:', error);
        throw error;
      }
      
      const finalCount = count || 0;
      console.log('Contagem final:', finalCount);
      
      setTodaysHumanMessages(finalCount);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Erro ao buscar contador:', error);
      setTodaysHumanMessages(0);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Função para buscar métricas detalhadas
  const fetchDetailedMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('employee_metrics')
        .select('*')
        .eq('metric_date', today)
        .order('total_messages', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar métricas:', error);
        return;
      }
      
      console.log('Métricas detalhadas:', data);
      setMetrics(data || []);
      
    } catch (error) {
      console.error('Erro ao buscar métricas detalhadas:', error);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  // Função para calcular métricas do dia (abordagem frontend)
  const calculateTodayMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      console.log('Calculando métricas para:', today.toISOString().split('T')[0]);
      
      const sources = ['crm', 'web', 'android'];
      const calculatedMetrics = [];
      
      // Lista de emojis para filtrar
      const emojiPatterns = [
        '❤️', '👍', '👎', '😊', '😂', '🎉', '🔥', '✅', '❌', '👏', '🙏', '💪', '🎯', '⭐', '✨', '🌟', '💯', '🚀', '💎'
      ];
      
      for (const source of sources) {
        // Construir query base com filtro melhorado para confirmações
        let query = supabase
          .from('uazapi_chat_messages')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('direction', 'outbound')
          .eq('metadata->>wasSentByApi', 'false')
          .eq('metadata->>source', source)
          .gte('created_at', startOfDay.toISOString())
          .lt('created_at', endOfDay.toISOString());
        
        // Aplicar filtros de exclusão (usando not.or corretamente)
        const exclusionPatterns = [
          '%passando pra lembrar%',
          '%horário com%',
          '%clínica odontomanager%',
          '%confirmar?%',
          '%especialmente para você%',
          '%tolerância:%',
          '%brackets% solta%',
          '%Obrigado por confirmar seu horário%',
          '%Gostaríamos de lembrar%'
        ];
        
        // Aplicar cada filtro individualmente (Supabase não suporta not.or com múltiplas condições)
        exclusionPatterns.forEach(pattern => {
          query = query.not('content', 'ilike', pattern);
        });
        
        // Adicionar filtros de emojis individualmente
        emojiPatterns.forEach(emoji => {
          query = query.not('content', 'eq', emoji);
        });
        
        // Excluir mensagens vazias
        query = query.not('content', 'eq', '').not('content', 'is', null);
        
        // Executar query
        const { data: messages, error } = await query.order('created_at', { ascending: true });
        
        if (error) {
          console.error(`Erro ao buscar mensagens para ${source}:`, error);
          continue;
        }
        
        if (!messages || messages.length === 0) {
          console.log(`Nenhuma mensagem encontrada para ${source}`);
          continue;
        }
        
        console.log(`Encontradas ${messages.length} mensagens para ${source}`);
        
        // Calcular métricas
        const metrics = calculateMetricsFromMessages(messages, today, source);
        
        // Salvar métricas
        const { error: insertError } = await supabase
          .from('employee_metrics')
          .upsert(metrics, { onConflict: 'metric_date,employee_source' });
        
        if (insertError) {
          console.error(`Erro ao salvar métricas para ${source}:`, insertError);
        } else {
          calculatedMetrics.push(metrics);
          console.log(`Métricas salvas para ${source}`);
        }
      }
      
      if (calculatedMetrics.length > 0) {
        toast.success('Métricas calculadas com sucesso!');
        // Buscar métricas atualizadas
        fetchDetailedMetrics();
      } else {
        toast.warning('Nenhuma mensagem encontrada para calcular métricas');
      }
      
    } catch (error) {
      console.error('Erro ao calcular métricas:', error);
      toast.error('Erro ao calcular métricas');
    } finally {
      setLoadingMetrics(false);
    }
  }, [fetchDetailedMetrics]);

  // Função para calcular métricas a partir das mensagens
  const calculateMetricsFromMessages = (messages: any[], date: Date, source: string) => {
    if (messages.length === 0) {
      return createEmptyMetrics(date, source);
    }
    
    // 1. Calcular tempos de ociosidade (corrigido)
    const idleTimes = [];
    for (let i = 1; i < messages.length; i++) {
      const prevTime = new Date(messages[i-1].created_at).getTime();
      const currTime = new Date(messages[i].created_at).getTime();
      const diffSeconds = (currTime - prevTime) / 1000;
      
      // Ajustado: intervalo mínimo de 30s para excluir respostas rápidas da mesma conversa
      // e máximo de 4h para excluir longos períodos de inatividade
      if (diffSeconds >= 30 && diffSeconds <= 14400) {
        idleTimes.push(diffSeconds);
      }
    }
    
    let avgIdleTime = 0;
    let medianIdleTime = 0;
    let minIdleTime = 0;
    let maxIdleTime = 0;
    let totalIdleTime = 0;
    
    if (idleTimes.length > 0) {
      idleTimes.sort((a, b) => a - b);
      avgIdleTime = idleTimes.reduce((sum, time) => sum + time, 0) / idleTimes.length;
      medianIdleTime = idleTimes[Math.floor(idleTimes.length / 2)];
      minIdleTime = idleTimes[0];
      maxIdleTime = idleTimes[idleTimes.length - 1];
      totalIdleTime = idleTimes.reduce((sum, time) => sum + time, 0);
    }
    
    // 2. Métricas de horário
    const firstMessageTime = new Date(messages[0].created_at);
    const lastMessageTime = new Date(messages[messages.length - 1].created_at);
    const workDurationMinutes = Math.round((lastMessageTime.getTime() - firstMessageTime.getTime()) / (1000 * 60));
    const messagesPerHour = workDurationMinutes > 0 ? (messages.length / workDurationMinutes) * 60 : 0;
    
    // 3. Distribuição por turno
    const shiftCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const hourlyCounts: { [key: number]: number } = {};
    
    messages.forEach(msg => {
      const hour = new Date(msg.created_at).getHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
      
      if (hour >= 6 && hour < 12) shiftCounts.morning++;
      else if (hour >= 12 && hour < 18) shiftCounts.afternoon++;
      else if (hour >= 18 && hour < 24) shiftCounts.evening++;
      else shiftCounts.night++;
    });
    
    // 4. Hora de pico
    let peakHour = 0;
    let peakHourMessages = 0;
    for (const [hour, count] of Object.entries(hourlyCounts)) {
      const hourNum = parseInt(hour);
      if (count > peakHourMessages) {
        peakHourMessages = count;
        peakHour = hourNum;
      }
    }
    
    // 5. Métricas adicionais
    const uniqueClients = new Set(messages.map(m => m.phone_number)).size;
    
    return {
      metric_date: date.toISOString().split('T')[0],
      employee_source: source,
      
      avg_idle_time_seconds: Math.round(avgIdleTime * 100) / 100,
      median_idle_time_seconds: Math.round(medianIdleTime * 100) / 100,
      min_idle_time_seconds: Math.round(minIdleTime * 100) / 100,
      max_idle_time_seconds: Math.round(maxIdleTime * 100) / 100,
      total_idle_time_seconds: Math.round(totalIdleTime * 100) / 100,
      
      first_message_time: firstMessageTime.toTimeString().split(' ')[0],
      last_message_time: lastMessageTime.toTimeString().split(' ')[0],
      work_duration_minutes: workDurationMinutes,
      messages_per_hour: Math.round(messagesPerHour * 100) / 100,
      
      morning_messages: shiftCounts.morning,
      afternoon_messages: shiftCounts.afternoon,
      evening_messages: shiftCounts.evening,
      night_messages: shiftCounts.night,
      
      total_messages: messages.length,
      unique_clients: uniqueClients,
      peak_hour: peakHour,
      peak_hour_messages: peakHourMessages,
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  };

  const createEmptyMetrics = (date: Date, source: string) => {
    return {
      metric_date: date.toISOString().split('T')[0],
      employee_source: source,
      
      avg_idle_time_seconds: 0,
      median_idle_time_seconds: 0,
      min_idle_time_seconds: 0,
      max_idle_time_seconds: 0,
      total_idle_time_seconds: 0,
      
      first_message_time: null,
      last_message_time: null,
      work_duration_minutes: 0,
      messages_per_hour: 0,
      
      morning_messages: 0,
      afternoon_messages: 0,
      evening_messages: 0,
      night_messages: 0,
      
      total_messages: 0,
      unique_clients: 0,
      peak_hour: null,
      peak_hour_messages: 0,
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  };

  // Função auxiliar para formatar tempo
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  };

  // Buscar dados ao carregar e configurar auto-refresh
  useEffect(() => {
    fetchTodaysMessageCount();
    fetchConfirmationMessages();
    fetchDetailedMetrics();
    fetchHourlyData();
    
    // Configurar auto-refresh a cada 5 minutos
    const interval = setInterval(() => {
      fetchTodaysMessageCount();
      fetchConfirmationMessages();
      fetchDetailedMetrics();
      fetchHourlyData();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchTodaysMessageCount, fetchConfirmationMessages, fetchDetailedMetrics, fetchHourlyData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-violet-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Monitoramento</h1>
                <p className="text-purple-200">Acompanhamento de mensagens enviadas pelos funcionários</p>
              </div>
            </div>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header com informações */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Mensagens do Dia</h2>
              <p className="text-gray-600 mt-1">
                Mensagens enviadas pelos funcionários em {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <div className="text-sm text-gray-500">
                  Última atualização: {lastUpdated.toLocaleTimeString('pt-BR')}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label htmlFor="start-date" className="text-sm font-medium">De:</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate.toISOString().split('T')[0]}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  className="w-36"
                />
                <Label htmlFor="end-date" className="text-sm font-medium">Até:</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate.toISOString().split('T')[0]}
                  onChange={(e) => setEndDate(new Date(e.target.value))}
                  className="w-36"
                />
              </div>
              <Button
                onClick={generatePeriodReport}
                disabled={loadingReport}
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <Download className={`h-4 w-4 mr-2 ${loadingReport ? 'animate-spin' : ''}`} />
                Relatório Excel
              </Button>
              <Button
                onClick={generatePDFReport}
                disabled={loadingReport}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <FileText className={`h-4 w-4 mr-2 ${loadingReport ? 'animate-spin' : ''}`} />
                Relatório PDF
              </Button>
              <Button
                onClick={fetchTodaysMessageCount}
                disabled={loadingMessages}
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingMessages ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                onClick={calculateTodayMetrics}
                disabled={loadingMetrics}
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <BarChart3 className={`h-4 w-4 mr-2 ${loadingMetrics ? 'animate-spin' : ''}`} />
                Calcular Métricas
              </Button>
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card de Mensagens Reais */}
            <Card className="shadow-lg border-purple-200 bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Mensagens Reais</p>
                    <p className="text-3xl font-bold text-purple-900 mt-2">
                      {loadingMessages ? (
                        <div className="flex items-center">
                          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                          Carregando...
                        </div>
                      ) : (
                        todaysHumanMessages
                      )}
                    </p>
                    <div className="text-sm text-gray-600 mt-1">
                      Excluindo confirmações, emojis e respostas rápidas
                    </div>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <MessageSquare className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card de Mensagens de Confirmação */}
            <Card className="shadow-lg border-amber-200 bg-gradient-to-br from-amber-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-600">Confirmações</p>
                    <p className="text-3xl font-bold text-amber-900 mt-2">
                      {loadingConfirmations ? (
                        <div className="flex items-center">
                          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                          Carregando...
                        </div>
                      ) : (
                        confirmationMessages
                      )}
                    </p>
                    <div className="text-sm text-gray-600 mt-1">
                      Mensagens de lembrete de horário
                    </div>
                  </div>
                  <div className="bg-amber-100 p-3 rounded-full">
                    <Clock className="h-8 w-8 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card de Total */}
            <Card className="shadow-lg border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Geral</p>
                    <p className="text-3xl font-bold text-blue-900 mt-2">
                      {todaysHumanMessages + confirmationMessages}
                    </p>
                    <div className="text-sm text-gray-600 mt-1">
                      Todas as mensagens enviadas
                    </div>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <BarChart3 className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card Principal - Contador */}
          <Card className="shadow-lg border-purple-200">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="bg-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="h-10 w-10 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Mensagens Enviadas Hoje
                </h3>
                <div className="text-6xl font-bold text-purple-600 mb-4">
                  {loadingMessages ? '...' : todaysHumanMessages}
                </div>
                <div className="text-gray-600 text-lg mb-6">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-purple-700 font-medium">
                    Atualizado automaticamente a cada 5 minutos
                  </span>
                </div>
              </div>
              
              {/* Explicação do Tempo Médio Ocioso */}
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-sm text-blue-800">
                    <div className="font-semibold mb-2">📊 Tempo Médio Ocioso:</div>
                    <div className="space-y-1 text-blue-700">
                      <div>• Mede o intervalo entre mensagens consecutivas do mesmo funcionário</div>
                      <div>• Exclui intervalos &lt; 30s (respostas rápidas da mesma conversa)</div>
                      <div>• Exclui intervalos &gt; 4h (longos períodos de inatividade)</div>
                      <div>• Não considera confirmações automáticas ou emojis</div>
                      <div>• Reflete o ritmo real de trabalho entre conversas diferentes</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 text-sm text-gray-600 mt-6">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>Contabiliza apenas mensagens enviadas por funcionários (wasSentByApi = false)</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>Exclui mensagens automáticas enviadas pelo bot</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>Não inclui mensagens de confirmação de horários e lembretes</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>Exclui emojis isolados e mensagens vazias</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>Considera apenas mensagens outbound (enviadas)</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>Tempo ocioso médio: intervalo ≥ 30s entre mensagens da mesma conversa</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>Filtro pelo dia atual, das 00:00 até o momento atual</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Barras - Mensagens por Hora */}
          <Card className="shadow-lg border-purple-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    Mensagens por Hora do Dia
                  </CardTitle>
                  <CardDescription>
                    Distribuição das mensagens enviadas ao longo das 24 horas
                  </CardDescription>
                </div>
                <Button
                  onClick={fetchHourlyData}
                  disabled={loadingChart}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingChart ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingChart ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
                    <span className="text-gray-600">Carregando dados do gráfico...</span>
                  </div>
                </div>
              ) : hourlyData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis 
                        dataKey="hour" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Mensagens', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px'
                        }}
                        formatter={(value: any) => [`${value} mensagens`, 'Total']}
                      />
                      <Legend />
                      <Bar 
                        dataKey="messages" 
                        fill="#8b5cf6" 
                        name="Mensagens Enviadas"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhuma mensagem encontrada para hoje</p>
                    <p className="text-sm text-gray-500 mt-2">
                      O gráfico será atualizado conforme as mensagens forem enviadas
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Métricas Detalhadas */}
          {metrics && metrics.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Métricas Detalhadas</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metrics.map((metric: any) => (
                  <Card key={`${metric.employee_source}-${metric.metric_date}`} className="shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900 capitalize">{metric.employee_source}</h4>
                        <div className="text-sm text-gray-500">{metric.total_messages} msgs</div>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Tempo de Ociosidade */}
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Tempo Médio Ocioso</div>
                          <div className="text-lg font-bold text-blue-600">
                            {formatTime(metric.avg_idle_time_seconds)}
                          </div>
                        </div>
                        
                        {/* Horário de Trabalho */}
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Horário de Trabalho</div>
                          <div className="text-sm text-gray-600">
                            {metric.first_message_time} - {metric.last_message_time}
                          </div>
                          <div className="text-xs text-gray-500">
                            {metric.work_duration_minutes} min ({metric.messages_per_hour} msg/h)
                          </div>
                        </div>
                        
                        {/* Distribuição por Turno */}
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-2">Distribuição por Turno</div>
                          <div className="space-y-1">
                            {[
                              { label: 'Manhã', value: metric.morning_messages, color: 'bg-yellow-500' },
                              { label: 'Tarde', value: metric.afternoon_messages, color: 'bg-blue-500' },
                              { label: 'Noite', value: metric.evening_messages, color: 'bg-purple-500' },
                              { label: 'Madrugada', value: metric.night_messages, color: 'bg-gray-500' }
                            ].map(shift => (
                              <div key={shift.label} className="flex items-center justify-between">
                                <span className="text-xs text-gray-600">{shift.label}</span>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${shift.color}`}></div>
                                  <span className="text-xs font-medium">{shift.value}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Hora de Pico */}
                        {metric.peak_hour !== null && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Hora de Pico</div>
                            <div className="text-sm text-gray-600">
                              {metric.peak_hour}h ({metric.peak_hour_messages} msgs)
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Resumo Geral */}
              <Card className="shadow-md border-green-200">
                <CardContent className="p-6">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Resumo do Dia
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {metrics.reduce((sum, m) => sum + m.total_messages, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total Mensagens</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatTime(
                          metrics.reduce((sum, m) => sum + m.avg_idle_time_seconds, 0) / metrics.length
                        )}
                      </div>
                      <div className="text-sm text-gray-600">Tempo Médio Ocioso</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(
                          metrics.reduce((sum, m) => sum + m.messages_per_hour, 0) / metrics.length
                        )}
                      </div>
                      <div className="text-sm text-gray-600">Msgs por Hora</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {Math.max(...metrics.map(m => m.peak_hour || 0))}h
                      </div>
                      <div className="text-sm text-gray-600">Pico Geral</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Informações Adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-md">
              <CardContent className="p-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Sobre esta métrica
                </h4>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>Contabiliza apenas mensagens enviadas por funcionários (wasSentByApi = false)</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>Exclui mensagens automáticas enviadas pelo bot</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>Não inclui mensagens de confirmação de horários</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>Ignora mensagens que são apenas emojis (❤️, 👍, etc.)</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>Considera apenas mensagens outbound (enviadas)</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>Filtro pelo dia atual, das 00:00 até o momento atual</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardContent className="p-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  Status do Sistema
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Conexão com banco</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-600 font-medium">Ativa</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Última atualização</span>
                    <span className="text-sm text-gray-900 font-medium">
                      {lastUpdated ? lastUpdated.toLocaleTimeString('pt-BR') : 'Carregando...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Próxima atualização</span>
                    <span className="text-sm text-gray-900 font-medium">
                      {lastUpdated ? new Date(lastUpdated.getTime() + 5 * 60 * 1000).toLocaleTimeString('pt-BR') : 'Carregando...'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card de Referência */}
          <Card className="shadow-md border-gray-200">
            <CardContent className="p-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Importante
              </h4>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  Esta métrica considera apenas a tabela <code className="bg-amber-100 px-1 rounded">uazapi_chat_messages</code> 
                  {' '}com os filtros <code className="bg-amber-100 px-1 rounded">direction = outbound</code> 
                  {' '}e <code className="bg-amber-100 px-1 rounded">wasSentByApi = false</code>.
                  <br /><br />
                  <strong>Importante:</strong> São excluídas automaticamente das métricas:
                  <br />• Mensagens de confirmação de horários
                  <br />• Mensagens que são apenas emojis (❤️, 👍, etc.)
                  <br />• Mensagens vazias
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Monitoramento;
