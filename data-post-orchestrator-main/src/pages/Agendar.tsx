import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { CalendarDays, Phone, Target, Search, Users, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Stethoscope, CheckCircle2, XCircle } from "lucide-react";
import { fetchAgendamentos, type Agendamento } from "@/lib/agendamentoApi";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, addWeeks, isSameMonth, isToday, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { LeadProfileDialog } from "@/components/LeadProfileDialog";

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
  campanha_id?: number | null;
  campanha_nome?: string | null;
}

interface CRMContext {
  posts: Post[];
}

const interestedStatuses = [
  "interessado",
  "interessado em agendar",
  "interessado em agendar consulta",
  "agendar",
];

const Agendar = () => {
  const { posts } = useOutletContext<CRMContext>();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarStyle, setCalendarStyle] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [leadDialog, setLeadDialog] = useState<Post | null>(null);

  useEffect(() => {
    const loadAgendamentos = async () => {
      try {
        setLoadingCalendar(true);
        setCalendarError(null);
        const data = await fetchAgendamentos();
        setAgendamentos(data || []);
      } catch (error) {
        console.error("Erro ao carregar agendamentos:", error);
        setCalendarError("Não foi possível carregar os agendamentos.");
      } finally {
        setLoadingCalendar(false);
      }
    };

    loadAgendamentos();
  }, []);

  const interestedLeads = useMemo(() => {
    return posts.filter((post) => {
      const status = post.status?.toLowerCase() ?? "";
      const matchesStatus = interestedStatuses.some((interest) => status.includes(interest));
      const matchesSearch = post.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (post.telefone?.includes(searchTerm) ?? false);
      const matchesCampaign = campaignFilter === "all" || post.campanha_nome === campaignFilter;
      return matchesStatus && matchesSearch && matchesCampaign;
    });
  }, [posts, searchTerm, campaignFilter]);

  const uniqueCampaigns = useMemo(() => {
    return Array.from(new Set(posts
      .filter((post) => {
        const status = post.status?.toLowerCase() ?? "";
        return interestedStatuses.some((interest) => status.includes(interest));
      })
      .map((post) => post.campanha_nome)
      .filter((name): name is string => !!name)));
  }, [posts]);

  const selectedLead = useMemo(
    () => interestedLeads.find((lead) => lead.id === selectedLeadId) ?? null,
    [interestedLeads, selectedLeadId]
  );

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const agendamentosByDate = useMemo(() => {
    return agendamentos.reduce<Record<string, Agendamento[]>>((acc, agendamento) => {
      const dateKey = format(new Date(agendamento.data_marcada), "yyyy-MM-dd");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(agendamento);
      return acc;
    }, {});
  }, [agendamentos]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Barra de busca e filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 text-sky-600">
            <Users className="w-4 h-4" />
          </div>
          <span><span className="font-semibold text-foreground">{interestedLeads.length}</span> lead(s) interessados</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-56 h-9 rounded-xl border-slate-200"
            />
          </div>
          {uniqueCampaigns.length > 0 && (
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="all">Todas campanhas</option>
              {uniqueCampaigns.map((campaign) => (
                <option key={campaign} value={campaign}>{campaign}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 flex-1 min-h-0">
        {/* Painel de leads */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50">
            <h2 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-sky-500" />
              Leads para agendar
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {interestedLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-sm">Nenhum lead interessado</p>
              </div>
            ) : (
              interestedLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => { setSelectedLeadId(lead.id); setLeadDialog(lead); }}
                  className={`w-full text-left rounded-xl p-3 transition-all border ${
                    selectedLeadId === lead.id
                      ? "border-sky-400 bg-sky-50 shadow-sm"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-white flex items-center justify-center font-semibold text-xs flex-shrink-0">
                        {lead.nome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate text-slate-800">{lead.nome}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {lead.telefone ?? "Sem telefone"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {lead.campanha_nome && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                        <Target className="w-2.5 h-2.5" />{lead.campanha_nome}
                      </span>
                    )}
                    {lead.tratamento && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        {lead.tratamento}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Calendário */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header do calendário */}
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            <div>
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-sky-500" />
                {selectedLead
                  ? <span>Agendando: <span className="text-sky-600">{selectedLead.nome}</span></span>
                  : "Calendário de agendamentos"}
              </h2>
              {!selectedLead && (
                <p className="text-xs text-muted-foreground mt-0.5">Selecione um lead à esquerda para iniciar.</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle mensal/semanal */}
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 gap-0.5">
                <button
                  onClick={() => setCalendarStyle('monthly')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    calendarStyle === 'monthly'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" /> Mensal
                </button>
                <button
                  onClick={() => setCalendarStyle('weekly')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    calendarStyle === 'weekly'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Semanal
                </button>
              </div>
              {/* Navegação */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <div className="min-w-[130px] text-center text-sm font-semibold text-slate-700 capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </div>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Hoje
              </button>
            </div>
          </div>

          {/* Corpo do calendário */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingCalendar ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Carregando calendário...</p>
              </div>
            ) : calendarError ? (
              <div className="flex items-center justify-center h-full text-destructive text-sm">
                {calendarError}
              </div>
            ) : calendarStyle === 'monthly' ? (
              <div className="flex flex-col gap-2 h-full">
                {/* Cabeçalho dos dias da semana */}
                <div className="grid grid-cols-7 mb-1">
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day, i) => (
                    <div key={day} className={`text-center text-xs font-semibold py-1 ${i >= 5 ? "text-rose-400" : "text-slate-400"}`}>
                      {day}
                    </div>
                  ))}
                </div>
                {/* Grid de dias */}
                <div className="grid grid-cols-7 gap-1.5 flex-1">
                  {calendarDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayAgendamentos = agendamentosByDate[dateKey] || [];
                    const todayDay = isToday(day);
                    const inCurrentMonth = isSameMonth(day, currentMonth);
                    const weekend = isWeekend(day);
                    const hasEvents = dayAgendamentos.length > 0;

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => hasEvents && setSelectedDay(day)}
                        className={`relative text-left rounded-xl p-2 flex flex-col text-xs min-h-[90px] transition-all group
                          ${inCurrentMonth ? "bg-white" : "bg-slate-50/60"}
                          ${todayDay ? "ring-2 ring-sky-400 ring-offset-1" : "border border-slate-100"}
                          ${hasEvents ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "cursor-default"}
                          ${weekend && inCurrentMonth ? "bg-rose-50/40" : ""}
                        `}
                      >
                        {/* Número do dia */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold transition-colors
                            ${todayDay ? "bg-sky-500 text-white" : inCurrentMonth ? (weekend ? "text-rose-400" : "text-slate-700") : "text-slate-300"}
                          `}>
                            {format(day, "d")}
                          </span>
                          {hasEvents && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600">
                              {dayAgendamentos.length}
                            </span>
                          )}
                        </div>
                        {/* Chips de agendamentos */}
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          {dayAgendamentos.slice(0, 3).map((ag) => (
                            <div
                              key={ag.id}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-white text-[10px] font-medium truncate ${getAgChipColor(ag)}`}
                            >
                              <Clock className="w-2.5 h-2.5 flex-shrink-0 opacity-80" />
                              <span className="flex-shrink-0 opacity-90">{getAgHorario(ag)}</span>
                              <span className="truncate">{ag.nome.split(" ")[0]}</span>
                              {ag.confirmado && getAgChipColor(ag) !== "bg-rose-500" && (
                                <span className="flex-shrink-0 ml-auto bg-emerald-400 rounded px-0.5 text-[8px] font-bold tracking-wide">✓</span>
                              )}
                            </div>
                          ))}
                          {dayAgendamentos.length > 3 && (
                            <span className="text-[10px] text-slate-400 pl-1">+{dayAgendamentos.length - 3} mais</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <WeeklyCalendar
                agendamentos={agendamentos}
                currentWeekStart={currentMonth}
                setCurrentWeekStart={setCurrentMonth}
                onSelectDay={(day) => setSelectedDay(day)}
              />
            )}
          </div>
        </div>
      </div>

      <DayModal
        date={selectedDay}
        agendamentos={selectedDay ? agendamentosByDate[format(selectedDay, "yyyy-MM-dd")] || [] : []}
        onClose={() => setSelectedDay(null)}
      />

      <LeadProfileDialog
        lead={leadDialog}
        isOpen={!!leadDialog}
        onClose={() => setLeadDialog(null)}
        onUpdate={() => setLeadDialog(null)}
      />
    </div>
  );
};

const getAgChipColor = (ag: Agendamento): string => {
  const p = ag.presenca?.toLowerCase() ?? "";
  if (p.includes("compareceu") && !p.includes("não") && !p.includes("nao")) return "bg-emerald-500";
  if (p.includes("não") || p.includes("nao")) return "bg-rose-500";
  return "bg-slate-400";
};

const getAgHorario = (ag: Agendamento): string => {
  try {
    return format(new Date(ag.data_marcada!), "HH:mm");
  } catch {
    return ag.horario || "";
  }
};

interface WeeklyCalendarProps {
  agendamentos: Agendamento[];
  currentWeekStart: Date;
  setCurrentWeekStart: (date: Date) => void;
  onSelectDay: (date: Date) => void;
}

const WeeklyCalendar = ({ agendamentos, currentWeekStart, setCurrentWeekStart, onSelectDay }: WeeklyCalendarProps) => {
  const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });

  const agendamentosByDate = useMemo(() => {
    return agendamentos.reduce<Record<string, Agendamento[]>>((acc, agendamento) => {
      const dateKey = format(new Date(agendamento.data_marcada), "yyyy-MM-dd");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(agendamento);
      return acc;
    }, {});
  }, [agendamentos]);

  const weekLabel = `${format(weekStart, "d MMM", { locale: ptBR })} – ${format(endOfWeek(weekStart, { weekStartsOn: 1 }), "d MMM yyyy", { locale: ptBR })}`;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Navegação semanal */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, -1))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Anterior
        </button>
        <span className="text-sm font-semibold text-slate-700 capitalize">{weekLabel}</span>
        <button
          onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Próxima <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Colunas dos dias */}
      <div className="grid grid-cols-7 gap-2 flex-1">
        {weekDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayAgendamentos = agendamentosByDate[dateKey] || [];
          const todayDay = isToday(day);
          const weekend = isWeekend(day);
          const hasEvents = dayAgendamentos.length > 0;

          return (
            <button
              key={day.toISOString()}
              onClick={() => hasEvents && onSelectDay(day)}
              className={`text-left rounded-xl flex flex-col text-xs min-h-[160px] overflow-hidden transition-all
                ${todayDay ? "ring-2 ring-sky-400 ring-offset-1" : "border border-slate-100"}
                ${hasEvents ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "cursor-default"}
                ${weekend ? "bg-rose-50/40" : "bg-white"}
              `}
            >
              {/* Header do dia */}
              <div className={`px-2 py-1.5 flex items-center justify-between border-b ${
                todayDay ? "bg-sky-500 border-sky-400" : weekend ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-100"
              }`}>
                <span className={`font-bold text-xs capitalize ${
                  todayDay ? "text-white" : weekend ? "text-rose-500" : "text-slate-700"
                }`}>
                  {format(day, "EEE", { locale: ptBR })}
                </span>
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${
                  todayDay ? "bg-white text-sky-600" : weekend ? "text-rose-400" : "text-slate-500"
                }`}>
                  {format(day, "d")}
                </span>
              </div>
              {/* Agendamentos */}
              <div className="flex flex-col gap-0.5 p-1.5 overflow-hidden flex-1">
                {dayAgendamentos.length === 0 ? (
                  <p className="text-slate-300 text-[10px] mt-1 text-center">—</p>
                ) : (
                  <>
                    {dayAgendamentos.slice(0, 4).map((ag) => (
                      <div
                        key={ag.id}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-white text-[10px] font-medium truncate ${getAgChipColor(ag)}`}
                      >
                        <Clock className="w-2.5 h-2.5 flex-shrink-0 opacity-80" />
                        <span className="flex-shrink-0 opacity-90">{getAgHorario(ag)}</span>
                        <span className="truncate">{ag.nome.split(" ")[0]}</span>
                        {ag.confirmado && getAgChipColor(ag) !== "bg-rose-500" && (
                          <span className="flex-shrink-0 ml-auto bg-emerald-400 rounded px-0.5 text-[8px] font-bold tracking-wide">✓</span>
                        )}
                      </div>
                    ))}
                    {dayAgendamentos.length > 4 && (
                      <span className="text-[10px] text-slate-400 pl-1">+{dayAgendamentos.length - 4} mais</span>
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface DayModalProps {
  date: Date | null;
  agendamentos: Agendamento[];
  onClose: () => void;
}

const presencaConfig: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  confirmado: { label: "Confirmado", icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: "bg-emerald-100 text-emerald-700" },
  cancelado:  { label: "Cancelado",  icon: <XCircle className="w-3.5 h-3.5" />,     cls: "bg-rose-100 text-rose-700" },
  faltou:     { label: "Faltou",     icon: <XCircle className="w-3.5 h-3.5" />,     cls: "bg-orange-100 text-orange-700" },
};

const DayModal = ({ date, agendamentos, onClose }: DayModalProps) => {
  const formattedDate = date ? format(date, "EEEE, d 'de' MMMM", { locale: ptBR }) : "";
  const todayDay = date ? isToday(date) : false;

  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl shadow-2xl p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Agendamentos do dia</DialogTitle>
        {/* Header do modal */}
        <div className={`px-5 pt-5 pb-4 rounded-t-2xl ${
          todayDay
            ? "bg-gradient-to-r from-sky-500 to-indigo-500"
            : "bg-gradient-to-r from-slate-700 to-slate-800"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Agendamentos</p>
              <h2 className="font-bold text-sm text-white capitalize truncate">{formattedDate}</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold text-white flex-shrink-0">
              {agendamentos.length} {agendamentos.length === 1 ? "consulta" : "consultas"}
            </span>
            <DialogClose className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0">
              <XCircle className="w-4 h-4 text-white" />
            </DialogClose>
          </div>
        </div>

        {/* Lista de agendamentos */}
        <div className="p-4">
          {agendamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <CalendarIcon className="w-6 h-6 opacity-30" />
              </div>
              <p className="text-sm">Nenhum agendamento para este dia</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {agendamentos
                .slice()
                .sort((a, b) => getAgHorario(a).localeCompare(getAgHorario(b)))
                .map((ag) => {
                  const colorCls = getAgChipColor(ag);
                  const p = ag.presenca?.toLowerCase() ?? "";
                  const compareceu = p.includes("compareceu") && !p.includes("não") && !p.includes("nao");
                  const naoCompareceu = p.includes("não") || p.includes("nao");
                  return (
                    <div
                      key={ag.id}
                      className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                        ag.confirmado ? "border-emerald-300" : "border-slate-100"
                      }`}
                    >
                      <div className="flex items-stretch">
                        <div className={`w-1.5 flex-shrink-0 ${colorCls}`} />
                        <div className="flex-1 px-3 py-2.5">
                          {/* Linha principal */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-7 h-7 rounded-full ${colorCls} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                                {ag.nome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-800 truncate">{ag.nome}</p>
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />{ag.telefone || "Sem telefone"}
                                </p>
                              </div>
                            </div>
                            {/* Horário */}
                            <span className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg flex-shrink-0">
                              <Clock className="w-3 h-3" />
                              {getAgHorario(ag)}
                            </span>
                          </div>

                          {/* Badges de status */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {/* Confirmação */}
                            {ag.confirmado ? (
                              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" /> Confirmado
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                <XCircle className="w-3 h-3" /> Não confirmado
                              </span>
                            )}
                            {/* Presença */}
                            {compareceu && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" /> Compareceu
                              </span>
                            )}
                            {naoCompareceu && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                <XCircle className="w-3 h-3" /> Não compareceu
                              </span>
                            )}
                            {!ag.presenca && (
                              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                                Presença não registrada
                              </span>
                            )}
                          </div>

                          {/* Dentista / Tratamento */}
                          <div className="flex flex-wrap gap-3 mt-1.5">
                            {ag.dentista && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                <Stethoscope className="w-3 h-3" />{ag.dentista}
                              </span>
                            )}
                            {ag.tratamento && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                <User className="w-3 h-3" />{ag.tratamento}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Agendar;
