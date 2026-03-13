import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { X, MessageSquare, Search, Filter, Users, Phone, Clock, Check, CheckCheck, AlertCircle, Target, Download, Loader2, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useMessageSender } from "@/hooks/useMessageSender";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { useMessageDeduplication } from "@/hooks/useMessageDeduplication";

// Interfaces - mesma estrutura do EmbeddedWhatsAppChat
interface Message {
  id: string;
  lead_id: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  status: string;
  provider_id: string | null;
  message_type: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: string;
  data: string | null;
  horario: string | null;
  tratamento: string | null;
  dentista: string | null;
  created_at: string;
  ultima_mensagem_at?: string | null;
  feedback: string | null;
  campanha_id?: number | null;
  campanha_nome?: string | null;
  instance_id?: string | null;
}

interface Chat {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  status: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isInAttendance: boolean;
  messages: Message[];
  instanceId?: string | null;
}

interface ChatInterfaceProps {
  leads: Lead[];
}

// Configuração
const MAX_CHATS = 4;
const CHAT_COLUMN_WIDTH = 350; // px (reduzido de 400)
const CONTACT_LIST_WIDTH = 320; // px (aumentado de 288)
const MIN_CHAT_WIDTH = 300; // px mínimo para legibilidade

// Cores de status
const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes("entrou")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (statusLower.includes("interessado")) return "bg-amber-100 text-amber-700 border-amber-200";
  if (statusLower.includes("agendou")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (statusLower.includes("compareceu") && !statusLower.includes("não")) return "bg-green-100 text-green-700 border-green-200";
  if (statusLower.includes("não")) return "bg-red-100 text-red-700 border-red-200";
  if (statusLower.includes("em negociação")) return "bg-purple-100 text-purple-700 border-purple-200";
  if (statusLower.includes("follow-up")) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (statusLower.includes("concluí")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (statusLower.includes("problema") || statusLower.includes("perdido")) return "bg-red-100 text-red-700 border-red-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
};

// Componente de mensagem individual
const SUPABASE_FUNCTIONS_URL = 'https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts';

const MEDIA_TYPES = new Set(['audio', 'ptt', 'image', 'video', 'document', 'sticker']);

const MediaContent = ({ message, onMediaLoaded }: { message: Message; onMediaLoaded: (id: string, url: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const mediaUrl = message.media_url;
  const msgType = message.message_type;

  const loadMedia = async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/process-whatsapp-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ messageRowId: message.id }),
      });
      const data = await res.json();
      if (data.mediaUrl) onMediaLoaded(message.id, data.mediaUrl);
      else setError(true);
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  if (mediaUrl && mediaUrl.startsWith('http')) {
    if (msgType === 'audio' || msgType === 'ptt') {
      return <audio controls src={mediaUrl} className="max-w-[220px] w-full mt-1" preload="metadata" />;
    }
    if (msgType === 'image' || msgType === 'sticker') {
      return <img src={mediaUrl} alt="imagem" className="max-w-[220px] rounded-lg mt-1 cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')} />;
    }
    if (msgType === 'video') {
      return <video controls src={mediaUrl} className="max-w-[220px] rounded-lg mt-1" preload="metadata" />;
    }
    if (msgType === 'document') {
      return (
        <a href={mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 mt-1 text-blue-600 underline text-xs">
          <Download className="w-3 h-3" /> Baixar documento
        </a>
      );
    }
  }

  // Sem media_url — mostrar botão carregar
  if (MEDIA_TYPES.has(msgType)) {
    return (
      <button
        onClick={loadMedia}
        disabled={loading}
        className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-black/10 hover:bg-black/20 text-xs font-medium transition-colors"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
        {loading ? 'Carregando...' : error ? 'Tentar novamente' : `Carregar ${msgType === 'ptt' ? 'áudio' : msgType}`}
      </button>
    );
  }
  return null;
};

const ChatMessage = ({ message, onMediaLoaded }: { message: Message; onMediaLoaded: (id: string, url: string) => void }) => {
  const isInbound = message.direction === 'inbound';
  const isMedia = MEDIA_TYPES.has(message.message_type);
  
  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'} mb-4 animate-fade-in`}>
      <div className={`max-w-[80%] ${
        isInbound 
          ? 'bg-gray-100 text-gray-900 rounded-r-2xl rounded-tl-2xl' 
          : 'bg-green-500 text-white rounded-l-2xl rounded-tr-2xl'
      } px-4 py-2 shadow-sm`}>
        {isMedia && <MediaContent message={message} onMediaLoaded={onMediaLoaded} />}
        {message.content && <p className="text-sm break-words mt-1">{message.content}</p>}
        {!isMedia && !message.content && <p className="text-sm break-words text-gray-400 italic">mensagem vazia</p>}
        <div className={`flex items-center gap-1 text-xs mt-1 ${
          isInbound ? 'text-gray-500' : 'text-green-100'
        }`}>
          {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
          {!isInbound && <Check className="w-3 h-3" />}
        </div>
      </div>
    </div>
  );
};

// Gerar variantes de telefone (fora do componente para evitar recriação)
const getPhoneVariants = (phone: string | null): string[] => {
  if (!phone) return [];
  const digits = phone.replace(/\D/g, '');
  const variants = new Set<string>();
  
  variants.add(digits);
  
  if (digits.startsWith('55')) {
    variants.add(digits.slice(2));
  } else {
    variants.add('55' + digits);
  }
  
  for (const v of [...variants]) {
    if (v.startsWith('55')) {
      const withoutCountry = v.slice(2);
      if (withoutCountry.length === 11) {
        const ddd = withoutCountry.slice(0, 2);
        const rest = withoutCountry.slice(3);
        variants.add('55' + ddd + rest);
        variants.add(ddd + rest);
        variants.add(ddd + '9' + rest);
      }
      if (withoutCountry.length === 10) {
        const ddd = withoutCountry.slice(0, 2);
        const rest = withoutCountry.slice(2);
        variants.add('55' + ddd + '9' + rest);
        variants.add(ddd + '9' + rest);
        variants.add(ddd + rest);
      }
    } else {
      if (v.length === 11) {
        const ddd = v.slice(0, 2);
        const rest = v.slice(3);
        variants.add(ddd + rest);
        variants.add('55' + ddd + rest);
        variants.add('55' + v);
      }
      if (v.length === 10) {
        const ddd = v.slice(0, 2);
        const rest = v.slice(2);
        variants.add(ddd + '9' + rest);
        variants.add('55' + ddd + '9' + rest);
        variants.add('55' + v);
      }
    }
  }
  
  return [...variants];
};

// Componente de coluna de chat
const ChatColumn = ({
  chat,
  onClose,
  onSendMessage
}: {
  chat: Chat;
  onClose: () => void;
  onSendMessage: (message: string) => void;
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // uazapiInstanceStringId: the UAZAPI string instance_id resolved from uazapi_instances
  const [uazapiInstanceStringId, setUazapiInstanceStringId] = useState<string | null | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const retryCountRef = useRef(0);

  // Memoizar variantes de telefone para evitar recálculo a cada render
  const phoneVariants = useMemo(() => getPhoneVariants(chat.leadPhone), [chat.leadPhone]);
  // Chave estável para usar como dependência de useEffect
  const phoneKey = useMemo(() => phoneVariants.sort().join(','), [phoneVariants]);

  // Resolve the UAZAPI string instance_id from the lead's instance_id (DB uuid)
  useEffect(() => {
    if (!chat.instanceId) {
      // No instance_id on lead — legacy behavior, show all messages
      setUazapiInstanceStringId(null);
      return;
    }
    let cancelled = false;
    const resolve = async () => {
      try {
        const { data, error } = await supabase
          .from('uazapi_instances' as any)
          .select('instance_id')
          .eq('id', chat.instanceId)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          console.warn('[ChatColumn] Could not resolve UAZAPI instance string id:', error?.message);
          setUazapiInstanceStringId(null);
          return;
        }
        setUazapiInstanceStringId((data as any).instance_id as string);
      } catch (err) {
        if (!cancelled) {
          console.warn('[ChatColumn] Error resolving UAZAPI instance string id:', err);
          setUazapiInstanceStringId(null);
        }
      }
    };
    resolve();
    return () => { cancelled = true; };
  }, [chat.instanceId]);

  // Fetch message history - usa chat.id + phoneKey para garantir re-fetch ao reabrir
  // Wait until uazapiInstanceStringId is resolved (undefined = pending)
  useEffect(() => {
    if (uazapiInstanceStringId === undefined) return;
    if (phoneVariants.length === 0) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    retryCountRef.current = 0;

    // Limpar mensagens antigas e mostrar loading imediatamente ao trocar de chat
    setMessages([]);
    setIsLoading(true);

    const fetchMessages = async () => {
      try {
        let query = supabase
          .from('uazapi_chat_messages' as any)
          .select('id, phone_number, direction, content, media_url, media_type, status, provider_id, message_type, metadata, created_at, updated_at')
          .or(phoneVariants.map(p => `phone_number.eq.${p}`).join(','))
          .order('created_at', { ascending: true });

        // Filter by instance when available (metadata->>instance_id matches UAZAPI string id)
        if (uazapiInstanceStringId) {
          query = (query as any).eq('metadata->>instance_id', uazapiInstanceStringId);
        }

        const { data, error } = await query;

        if (cancelled) return;
        if (error) throw error;
        setMessages((data || []) as unknown as Message[]);
        retryCountRef.current = 0;
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching messages:", error);
        // Retry automático até 2x com delay crescente
        if (retryCountRef.current < 2) {
          retryCountRef.current++;
          setTimeout(() => {
            if (!cancelled) fetchMessages();
          }, retryCountRef.current * 1000);
          return;
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchMessages();
    return () => { cancelled = true; };
  }, [phoneKey, chat.id, uazapiInstanceStringId]);

  // Subscribe to real-time updates - canal único por chat
  useEffect(() => {
    if (uazapiInstanceStringId === undefined) return;
    if (phoneVariants.length === 0) return;

    const phoneSet = new Set(phoneVariants);
    const channelName = `chat-${chat.id}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'uazapi_chat_messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (!phoneSet.has(newMsg.phone_number)) return;
          // Instance filter for realtime: if we have a filter, check metadata
          if (uazapiInstanceStringId) {
            const msgInstanceId = newMsg.metadata?.instance_id;
            if (msgInstanceId && msgInstanceId !== uazapiInstanceStringId) return;
          }
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'uazapi_chat_messages' },
        (payload) => {
          const updated = payload.new as Message;
          if (updated.media_url && phoneSet.has(updated.phone_number)) {
            setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, media_url: updated.media_url } : m));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phoneKey, chat.id, uazapiInstanceStringId]);

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || isSending) return;
    
    setIsSending(true);
    try {
      await onSendMessage(message);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  }, [message, isSending, onSendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{chat.leadName}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Phone className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">{chat.leadPhone}</span>
            <Badge className={`text-xs ${getStatusColor(chat.status)}`}>
              {chat.status}
            </Badge>
          </div>
          {chat.isInAttendance && (
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600">Em atendimento</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Área de Mensagens */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onMediaLoaded={(id, url) => setMessages(prev => prev.map(m => m.id === id ? { ...m, media_url: url } : m))}
              />
            ))}
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma mensagem ainda</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Campo de Input */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite uma mensagem..."
            disabled={isSending}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            size="sm"
            className="h-10 px-4"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Componente principal
export const ChatInterface = ({ leads }: ChatInterfaceProps) => {
  const [openChats, setOpenChats] = useState<Chat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calcular largura disponível para chats
  const availableWidth = useMemo(() => {
    if (containerWidth <= CONTACT_LIST_WIDTH) return 0;
    return containerWidth - CONTACT_LIST_WIDTH;
  }, [containerWidth]);

  // Calcular largura de cada coluna de chat
  const chatColumnWidth = useMemo(() => {
    if (openChats.length === 0) return 0;
    const maxWidth = Math.floor(availableWidth / openChats.length);
    return Math.max(MIN_CHAT_WIDTH, Math.min(maxWidth, CHAT_COLUMN_WIDTH));
  }, [availableWidth, openChats.length]);

  // Monitorar tamanho do container
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Hooks de funcionalidades em tempo real
  const { notifyNewMessage, notifyChatOpened, isSupported } = useChatNotifications({
    enabled: true,
    soundEnabled: true
  });

  const { sendMessage: sendRealMessage, isSending } = useMessageSender({
    onMessageSent: (message) => {
      console.log('Message sent successfully:', message);
    },
    onMessageError: (messageId, error) => {
      console.error('Message send error:', { messageId, error });
    }
  });

  // Status únicos para filtros
  const uniqueStatuses = useMemo(() => {
    const statuses = [...new Set(leads.map(lead => lead.status).filter(Boolean))];
    return statuses.sort();
  }, [leads]);

  // Campanhas únicas para filtros
  const uniqueCampaigns = useMemo(() => {
    const campaigns = [...new Set(leads.map(lead => lead.campanha_nome).filter(Boolean))];
    return campaigns.sort();
  }, [leads]);

  // Leads filtrados
  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    // Filtro de busca
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(lead =>
        lead.nome.toLowerCase().includes(searchLower) ||
        (lead.telefone && lead.telefone.includes(searchTerm))
      );
    }

    // Filtro de status
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(lead =>
        selectedStatuses.includes(lead.status)
      );
    }

    // Filtro de campanha
    if (selectedCampaigns.length > 0) {
      filtered = filtered.filter(lead =>
        selectedCampaigns.includes(lead.campanha_nome || '')
      );
    }

    // Ordenação por ultima_mensagem_at (mais recente primeiro), fallback para created_at
    return filtered.sort((a, b) => {
      const timeA = a.ultima_mensagem_at ? new Date(a.ultima_mensagem_at + 'Z').getTime() : new Date(a.created_at).getTime();
      const timeB = b.ultima_mensagem_at ? new Date(b.ultima_mensagem_at + 'Z').getTime() : new Date(b.created_at).getTime();
      return timeB - timeA;
    });
  }, [leads, searchTerm, selectedStatuses, selectedCampaigns]);

  // Abrir chat
  const openChat = useCallback((lead: Lead) => {
    // Verificar se chat já está aberto
    const existingChat = openChats.find(chat => chat.leadId === lead.id);
    if (existingChat) {
      // Focar no chat existente (implementar foco se necessário)
      return;
    }

    // Verificar limite máximo
    if (openChats.length >= MAX_CHATS) {
      alert(`Máximo de ${MAX_CHATS} conversas simultâneas permitido`);
      return;
    }

    // Criar novo chat (timestamp garante re-mount ao reabrir mesmo lead)
    const newChat: Chat = {
      id: `chat-${lead.id}-${Date.now()}`,
      leadId: lead.id,
      leadName: lead.nome,
      leadPhone: lead.telefone || 'Não informado',
      status: lead.status,
      lastMessage: '',
      lastMessageTime: new Date(),
      unreadCount: 0,
      isInAttendance: true,
      messages: [], // Mensagens serão carregadas do banco
      instanceId: lead.instance_id || null,
    };

    setOpenChats(prev => [...prev, newChat]);
    
    // Notificar abertura do chat
    notifyChatOpened(lead.nome);
  }, [openChats, notifyChatOpened]);

  // Fechar chat
  const closeChat = useCallback((chatId: string) => {
    setOpenChats(prev => prev.filter(chat => chat.id !== chatId));
  }, []);

  // Enviar mensagem
  const sendMessage = useCallback(async (chatId: string, content: string) => {
    const chat = openChats.find(c => c.id === chatId);
    if (!chat) return;

    try {
      // Usar o hook useMessageSender para enviar mensagem
      await sendRealMessage(chat.leadId, content);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [openChats, sendRealMessage]);

  
  // Toggle status filter
  const toggleStatus = useCallback((status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  }, []);

  // Toggle campaign filter
  const toggleCampaign = useCallback((campaign: string) => {
    setSelectedCampaigns(prev => 
      prev.includes(campaign)
        ? prev.filter(c => c !== campaign)
        : [...prev, campaign]
    );
  }, []);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Lista de Contatos */}
      <div className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0`} style={{ width: `${CONTACT_LIST_WIDTH}px` }}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Conversas</h2>
          
          {/* Busca */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar contatos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex-1 mr-2"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {(selectedStatuses.length > 0 || selectedCampaigns.length > 0) && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {selectedStatuses.length + selectedCampaigns.length}
                </Badge>
              )}
            </Button>
            
            <Badge variant="outline" className="text-xs">
              {openChats.length}/{MAX_CHATS}
            </Badge>
          </div>

          {/* Filtros Expandidos */}
          {showFilters && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
              <div className="text-xs font-medium text-gray-700 mb-2">Filtrar por Status:</div>
              <div className="space-y-1 max-h-32 overflow-y-auto mb-3">
                {uniqueStatuses.map(status => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() => toggleStatus(status)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-xs text-gray-700">{status}</span>
                  </label>
                ))}
              </div>
              
              {uniqueCampaigns.length > 0 && (
                <>
                  <div className="text-xs font-medium text-gray-700 mb-2">Filtrar por Campanha:</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {uniqueCampaigns.map(campaign => (
                      <label key={campaign} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedCampaigns.includes(campaign)}
                          onChange={() => toggleCampaign(campaign)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-700">{campaign}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Lista de Contatos */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum contato encontrado</p>
              </div>
            ) : (
              filteredLeads.map(lead => (
                <div
                  key={lead.id}
                  onClick={() => openChat(lead)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors mb-1 hover:bg-gray-50`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{lead.nome}</h4>
                      <div className="flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{lead.telefone || 'Não informado'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(lead.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                  </div>
                  
                  {lead.feedback && (
                    <p className="text-xs text-gray-600 truncate mt-1">
                      {lead.feedback}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge className={`text-xs ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </Badge>
                    {lead.tratamento && (
                      <span className="text-xs text-gray-500">{lead.tratamento}</span>
                    )}
                    {lead.campanha_nome && (
                      <Badge className="bg-purple-100 text-purple-700 text-[10px] h-5 font-semibold px-2 rounded-full border-0 flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {lead.campanha_nome}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Área de Chats - Responsiva */}
      <div className="flex-1 flex min-w-0" ref={containerRef}>
        {openChats.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma conversa aberta</h3>
              <p className="text-sm text-gray-500">Selecione um contato da lista para começar</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 p-4 overflow-x-auto">
            {openChats.map(chat => (
              <div 
                key={chat.id} 
                className="flex-shrink-0 transition-all duration-200"
                style={{ 
                  width: chatColumnWidth,
                  minWidth: `${MIN_CHAT_WIDTH}px`
                }}
              >
                <ChatColumn
                  key={chat.id}
                  chat={chat}
                  onClose={() => closeChat(chat.id)}
                  onSendMessage={(content) => sendMessage(chat.id, content)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
