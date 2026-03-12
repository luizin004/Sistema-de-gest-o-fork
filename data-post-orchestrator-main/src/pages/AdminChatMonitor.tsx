import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { supabaseUntyped } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search, MessageSquare, Users, Phone, Bot, User, Clock,
  ChevronLeft, Eye, Filter, RefreshCw, AlertCircle, CheckCircle2,
  PauseCircle, ArrowLeft,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface Conversation {
  id: string;
  tenant_id: string;
  post_id: string | null;
  phone_number: string;
  chatbot_config_id: string | null;
  bot_active: boolean;
  message_count: number;
  current_funnel_status: string | null;
  pause_reason: string | null;
  scheduling_state: string | null;
  last_patient_message_at: string | null;
  last_bot_response_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  status: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  phone_number: string;
  direction: "inbound" | "outbound";
  sender: string | null;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  message_type: string;
  status: string;
  metadata: Record<string, any> | null;
  created_at: string;
  tenant_id: string;
}

interface UserInfo {
  id: string;
  nome: string;
  email: string;
  tenant_id: string;
  empresa: string | null;
}

// ============================================================================
// Status helpers
// ============================================================================

const getStatusColor = (status: string | null) => {
  if (!status) return "bg-gray-100 text-gray-600";
  const s = status.toLowerCase();
  if (s.includes("agendou")) return "bg-emerald-100 text-emerald-700";
  if (s.includes("interessado") || s.includes("engajou")) return "bg-amber-100 text-amber-700";
  if (s.includes("atencao") || s.includes("atenção")) return "bg-red-100 text-red-700";
  if (s.includes("respondeu")) return "bg-blue-100 text-blue-700";
  if (s.includes("reagendando")) return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-600";
};

const getBotBadge = (active: boolean) =>
  active
    ? { label: "Bot ativo", className: "bg-green-100 text-green-700" }
    : { label: "Bot pausado", className: "bg-orange-100 text-orange-700" };

// ============================================================================
// Main Component
// ============================================================================

const AdminChatMonitor = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();

  // State: users list (admin sees all users of the tenant)
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // State: conversations list
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [leads, setLeads] = useState<Map<string, Lead>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [botFilter, setBotFilter] = useState<string>("all");
  const [loadingConversations, setLoadingConversations] = useState(false);

  // State: selected conversation detail
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ========================================================================
  // Fetch users (all from same tenant)
  // ========================================================================
  const fetchUsers = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await (supabaseUntyped as any)
      .from("usuarios")
      .select("id, nome, email, tenant_id, empresa")
      .eq("tenant_id", tenantId)
      .order("nome", { ascending: true });
    setUsers((data || []) as UserInfo[]);
  }, [tenantId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ========================================================================
  // Fetch conversations (all or filtered by user)
  // ========================================================================
  const fetchConversations = useCallback(async () => {
    if (!tenantId) return;
    setLoadingConversations(true);

    const { data, error } = await (supabase as any)
      .from("chatbot_conversations")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Erro ao buscar conversas:", error);
      setLoadingConversations(false);
      return;
    }

    const convs = (data || []) as Conversation[];
    setConversations(convs);

    // Fetch leads for these conversations
    const postIds = convs.map((c) => c.post_id).filter(Boolean) as string[];
    if (postIds.length > 0) {
      const { data: leadsData } = await (supabase as any)
        .from("posts")
        .select("id, nome, telefone, status, tenant_id, created_at, updated_at")
        .in("id", postIds);

      const leadsMap = new Map<string, Lead>();
      (leadsData || []).forEach((l: Lead) => leadsMap.set(l.id, l));
      setLeads(leadsMap);
    }

    setLoadingConversations(false);
  }, [tenantId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ========================================================================
  // Fetch messages for a conversation
  // ========================================================================
  const fetchMessages = useCallback(async (phoneNumber: string) => {
    if (!tenantId) return;
    setLoadingMessages(true);

    const { data, error } = await (supabase as any)
      .from("uazapi_chat_messages")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("phone_number", phoneNumber)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      console.error("Erro ao buscar mensagens:", error);
    }

    setMessages((data || []) as ChatMessage[]);
    setLoadingMessages(false);
  }, [tenantId]);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Real-time subscription for new messages in selected conversation
  useEffect(() => {
    if (!selectedConv || !tenantId) return;

    const channel = supabase
      .channel(`admin-monitor-${selectedConv.phone_number}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "uazapi_chat_messages",
          filter: `phone_number=eq.${selectedConv.phone_number}`,
        },
        (payload: any) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg.tenant_id === tenantId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv, tenantId]);

  // ========================================================================
  // Select a conversation
  // ========================================================================
  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConv(conv);
    fetchMessages(conv.phone_number);
  };

  // ========================================================================
  // Filtered conversations
  // ========================================================================
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const lead = conv.post_id ? leads.get(conv.post_id) : null;
      const name = lead?.nome || conv.phone_number;

      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !name.toLowerCase().includes(term) &&
          !conv.phone_number.includes(term)
        )
          return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if ((conv.current_funnel_status || "") !== statusFilter) return false;
      }

      // Bot filter
      if (botFilter === "active" && !conv.bot_active) return false;
      if (botFilter === "paused" && conv.bot_active) return false;

      return true;
    });
  }, [conversations, leads, searchTerm, statusFilter, botFilter]);

  // Unique statuses for filter dropdown
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    conversations.forEach((c) => {
      if (c.current_funnel_status) statuses.add(c.current_funnel_status);
    });
    return Array.from(statuses).sort();
  }, [conversations]);

  // ========================================================================
  // Render: Conversations List
  // ========================================================================
  const renderConversationsList = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-purple-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-800">Monitor de Conversas</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchConversations}
            className="text-slate-500"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1 bg-white h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {uniqueStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={botFilter} onValueChange={setBotFilter}>
            <SelectTrigger className="w-36 bg-white h-8 text-xs">
              <Bot className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Bot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Bot ativo</SelectItem>
              <SelectItem value="paused">Bot pausado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2 bg-slate-50 border-b flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {filteredConversations.length} conversas
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {conversations.filter((c) => c.bot_active).length} bots ativos
        </span>
        <span className="flex items-center gap-1">
          <PauseCircle className="h-3 w-3 text-orange-500" />
          {conversations.filter((c) => !c.bot_active).length} pausados
        </span>
      </div>

      {/* Conversations list */}
      <ScrollArea className="flex-1">
        {loadingConversations ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredConversations.map((conv) => {
              const lead = conv.post_id ? leads.get(conv.post_id) : null;
              const name = lead?.nome || conv.phone_number;
              const botBadge = getBotBadge(conv.bot_active);
              const isSelected = selectedConv?.id === conv.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full text-left p-3 hover:bg-purple-50/50 transition-colors ${
                    isSelected ? "bg-purple-50 border-l-4 border-purple-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-800 truncate">
                          {name}
                        </span>
                        {!conv.bot_active && (
                          <AlertCircle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <Phone className="h-3 w-3 inline mr-1" />
                        {conv.phone_number}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                      {conv.updated_at && (
                        <span className="text-[10px] text-slate-400">
                          {formatDistanceToNow(new Date(conv.updated_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      )}
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${botBadge.className}`}>
                        {botBadge.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${getStatusColor(conv.current_funnel_status)}`}>
                      {conv.current_funnel_status || "sem status"}
                    </Badge>
                    {conv.scheduling_state && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {conv.scheduling_state}
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {conv.message_count} msgs
                    </span>
                  </div>
                  {conv.pause_reason && !conv.bot_active && (
                    <p className="text-[10px] text-orange-500 mt-1 truncate">
                      Motivo: {conv.pause_reason}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // ========================================================================
  // Render: Chat Detail (read-only)
  // ========================================================================
  const renderChatDetail = () => {
    if (!selectedConv) {
      return (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center text-slate-400">
            <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Selecione uma conversa</p>
            <p className="text-sm mt-1">Clique em uma conversa para visualizar as mensagens</p>
          </div>
        </div>
      );
    }

    const lead = selectedConv.post_id ? leads.get(selectedConv.post_id) : null;
    const name = lead?.nome || selectedConv.phone_number;
    const botBadge = getBotBadge(selectedConv.bot_active);

    return (
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat header */}
        <div className="px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-purple-50 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSelectedConv(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{name}</span>
              <Badge variant="secondary" className={`text-[10px] ${botBadge.className}`}>
                {botBadge.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{selectedConv.phone_number}</span>
              <span>{selectedConv.message_count} mensagens</span>
              {selectedConv.current_funnel_status && (
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${getStatusColor(selectedConv.current_funnel_status)}`}>
                  {selectedConv.current_funnel_status}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
              <Eye className="h-3 w-3 mr-1" />
              Somente leitura
            </Badge>
          </div>
        </div>

        {/* Conversation info bar */}
        {(selectedConv.scheduling_state || selectedConv.pause_reason) && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-4 text-xs">
            {selectedConv.scheduling_state && (
              <span className="text-amber-700">
                Agendamento: <strong>{selectedConv.scheduling_state}</strong>
              </span>
            )}
            {selectedConv.pause_reason && (
              <span className="text-orange-600">
                Pausado: <strong>{selectedConv.pause_reason}</strong>
              </span>
            )}
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" style={{ height: "calc(100vh - 340px)" }}>
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma mensagem nesta conversa</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {messages.map((msg) => {
                const isInbound = msg.direction === "inbound";
                const isBotMsg =
                  !isInbound && msg.metadata?.source !== "human";

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                        isInbound
                          ? "bg-white border border-slate-200 rounded-bl-md"
                          : isBotMsg
                          ? "bg-purple-100 text-purple-900 rounded-br-md"
                          : "bg-blue-500 text-white rounded-br-md"
                      }`}
                    >
                      {/* Sender label */}
                      <div className={`flex items-center gap-1 mb-0.5 text-[10px] ${
                        isInbound ? "text-slate-400" : isBotMsg ? "text-purple-500" : "text-blue-200"
                      }`}>
                        {isInbound ? (
                          <><User className="h-2.5 w-2.5" /> Paciente</>
                        ) : isBotMsg ? (
                          <><Bot className="h-2.5 w-2.5" /> Bot</>
                        ) : (
                          <><User className="h-2.5 w-2.5" /> Humano</>
                        )}
                      </div>

                      {/* Media indicator */}
                      {msg.message_type !== "text" && msg.message_type && (
                        <div className={`text-[10px] mb-1 italic ${
                          isInbound ? "text-slate-400" : isBotMsg ? "text-purple-400" : "text-blue-200"
                        }`}>
                          [{msg.message_type}]
                        </div>
                      )}

                      {/* Content */}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.content || `[${msg.message_type || "sem conteudo"}]`}
                      </p>

                      {/* Timestamp */}
                      <div className={`text-[10px] mt-1 text-right ${
                        isInbound ? "text-slate-300" : isBotMsg ? "text-purple-400" : "text-blue-200"
                      }`}>
                        {msg.created_at
                          ? format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })
                          : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Read-only footer */}
        <div className="px-4 py-3 border-t bg-slate-50 text-center text-xs text-slate-400">
          <Eye className="h-3.5 w-3.5 inline mr-1" />
          Modo monitoramento - somente leitura
        </div>
      </div>
    );
  };

  // ========================================================================
  // Main render
  // ========================================================================
  return (
    <div className="h-[calc(100vh-60px)] bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="text-slate-500">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Painel Admin
        </Button>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-sm font-medium text-slate-700">Monitor de Conversas</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
      {/* Left panel: conversations list */}
      <div
        className={`border-r border-slate-200 bg-white flex flex-col ${
          selectedConv ? "hidden md:flex" : "flex"
        }`}
        style={{ width: 380, minWidth: 380 }}
      >
        {renderConversationsList()}
      </div>

      {/* Right panel: chat detail */}
      <div className={`flex-1 flex flex-col ${!selectedConv ? "hidden md:flex" : "flex"}`}>
        {renderChatDetail()}
      </div>
      </div>
    </div>
  );
};

export default AdminChatMonitor;
