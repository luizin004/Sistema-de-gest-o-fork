import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Send, MessageSquare, Download, Loader2, AlertCircle, RotateCcw, CheckCheck, Trash2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMessageSender } from "@/hooks/useMessageSender";

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

interface EmbeddedWhatsAppChatProps {
  contactName: string;
  contactPhone: string | null;
  instanceId?: string | null;
}

const SUPABASE_FN_URL = 'https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1';
const SUPABASE_ANON_KEY_EMB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts';
const MEDIA_TYPES_EMB = new Set(['audio', 'ptt', 'image', 'video', 'document', 'sticker']);

const EmbMediaContent = ({ message, onLoaded }: { message: Message; onLoaded: (id: string, url: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { media_url: mediaUrl, message_type: msgType } = message;

  const load = async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch(`${SUPABASE_FN_URL}/process-whatsapp-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY_EMB}` },
        body: JSON.stringify({ messageRowId: message.id }),
      });
      const data = await res.json();
      if (data.mediaUrl) onLoaded(message.id, data.mediaUrl);
      else setError(true);
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  if (mediaUrl && mediaUrl.startsWith('http')) {
    if (msgType === 'audio' || msgType === 'ptt')
      return <audio controls src={mediaUrl} className="max-w-full w-full mt-1" preload="metadata" />;
    if (msgType === 'image' || msgType === 'sticker')
      return <img src={mediaUrl} alt="imagem" className="max-w-[200px] rounded-lg mt-1 cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')} />;
    if (msgType === 'video')
      return <video controls src={mediaUrl} className="max-w-[200px] rounded-lg mt-1" preload="metadata" />;
    if (msgType === 'document')
      return <a href={mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 mt-1 text-blue-600 underline text-[10px]"><Download className="w-3 h-3" /> Baixar documento</a>;
  }

  if (MEDIA_TYPES_EMB.has(msgType)) {
    return (
      <button onClick={load} disabled={loading}
        className="flex items-center gap-1 mt-1 px-2 py-1 rounded-lg bg-black/10 hover:bg-black/20 text-[10px] font-medium transition-colors">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
        {loading ? 'Carregando...' : error ? 'Tentar novamente' : `Carregar ${msgType === 'ptt' ? 'áudio' : msgType}`}
      </button>
    );
  }
  return null;
};

export const EmbeddedWhatsAppChat = ({ contactName, contactPhone, instanceId }: EmbeddedWhatsAppChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingLocal, setIsSendingLocal] = useState(false);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSendingAiResponse, setIsSendingAiResponse] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { sendMessage } = useMessageSender({
    onMessageSent: (msg) => {
      setMessages(prev => prev.map(m =>
        (m.metadata as any)?._tempId === (msg as any).id
          ? { ...m, status: 'sent', id: msg.id }
          : m
      ));
      setIsSendingLocal(false);
    },
    onMessageError: (msgId, err) => {
      setMessages(prev => prev.map(m =>
        (m.metadata as any)?._tempId === msgId
          ? { ...m, status: 'error' }
          : m
      ));
      console.error("Send error", err);
      setIsSendingLocal(false);
    }
  });

  // Memoizar variantes de telefone — evita recálculo e re-renders desnecessários
  const phoneVariants = useMemo(() => {
    if (!contactPhone) return [];
    const digits = contactPhone.replace(/\D/g, '');
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
  }, [contactPhone]);

  // Chave estável para usar como dependência de useEffect
  const phoneKey = useMemo(() => [...phoneVariants].sort().join(','), [phoneVariants]);

  const handleDeleteHistory = useCallback(async () => {
    if (phoneVariants.length === 0) return;
    setIsDeletingHistory(true);
    try {
      let query = supabase
        .from('uazapi_chat_messages' as any)
        .delete()
        .or(phoneVariants.map(p => `phone_number.eq.${p}`).join(','));
      if (instanceId) {
        query = (query as any).eq('instance_id', instanceId);
      } else {
        query = (query as any).is('instance_id', null);
      }
      const { error } = await query;
      if (error) throw error;

      // Also reset the conversation for this instance
      if (instanceId) {
        await supabase
          .from('chatbot_conversations' as any)
          .delete()
          .or(phoneVariants.map(p => `phone_number.eq.${p}`).join(','))
          .eq('instance_id', instanceId);
      }

      setMessages([]);
      toast.success("Histórico de mensagens apagado!");
    } catch (error) {
      console.error("Error deleting history:", error);
      toast.error("Erro ao apagar histórico");
    } finally {
      setIsDeletingHistory(false);
      setShowDeleteConfirm(false);
    }
  }, [phoneVariants, instanceId]);

  // Trigger a single AI response to the latest unanswered messages
  const handleSendAiResponse = useCallback(async () => {
    if (!contactPhone) return;
    setIsSendingAiResponse(true);
    try {
      // Find the lead for this phone+instance
      let leadQuery = supabase.from('posts').select('id').eq('telefone', contactPhone);
      if (instanceId) leadQuery = leadQuery.eq('instance_id', instanceId);
      const { data: leadData } = await leadQuery.maybeSingle();

      if (!leadData?.id) {
        toast.error("Lead não encontrado");
        setIsSendingAiResponse(false);
        return;
      }

      // Reactivate bot for one response: set bot_active=true, then send a synthetic webhook
      // We do this by calling the chatbot-webhook function with the last inbound message
      const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');
      if (!lastInbound) {
        toast.error("Nenhuma mensagem do cliente para responder");
        setIsSendingAiResponse(false);
        return;
      }

      // Temporarily reactivate bot using post_id (reliable, no phone format issues)
      await supabase
        .from('chatbot_conversations' as any)
        .update({ bot_active: true, pause_reason: null })
        .eq('post_id', leadData.id);

      // Look up the UAZAPI instance_id string from the DB uuid
      let uazapiInstanceId = instanceId;
      if (instanceId) {
        const { data: instData } = await supabase
          .from('uazapi_instances' as any)
          .select('instance_id, name')
          .eq('id', instanceId)
          .maybeSingle();
        if (instData) {
          uazapiInstanceId = (instData as any).instance_id || (instData as any).name || instanceId;
        }
      }

      // Call chatbot-webhook with _replay flag to skip storing the inbound message
      const res = await fetch(`${SUPABASE_FN_URL}/chatbot-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: contactPhone,
          body: lastInbound.content || '',
          type: 'text',
          instanceId: uazapiInstanceId || undefined,
          _replay: true,
        }),
      });

      if (res.ok) {
        toast.success("Resposta de IA enviada!");
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("AI response error:", errData);
        toast.error("Erro ao enviar resposta de IA");
      }
    } catch (error) {
      console.error("Error sending AI response:", error);
      toast.error("Erro ao enviar resposta de IA");
    } finally {
      setIsSendingAiResponse(false);
    }
  }, [contactPhone, instanceId, messages, phoneVariants]);

  useEffect(() => {
    if (phoneVariants.length === 0) {
      setMessages([]);
      return;
    }
    let cancelled = false;

    // Limpar mensagens antigas imediatamente ao trocar de lead
    setMessages([]);
    setIsLoading(true);

    const fetchMessages = async () => {
      try {
        let query = supabase
          .from('uazapi_chat_messages' as any)
          .select('*')
          .or(phoneVariants.map(p => `phone_number.eq.${p}`).join(','))
          .order('created_at', { ascending: true });

        // Always filter by instance to isolate conversations
        if (instanceId) {
          query = (query as any).eq('instance_id', instanceId);
        } else {
          query = (query as any).is('instance_id', null);
        }

        const { data, error } = await query;

        if (cancelled) return;
        if (error) throw error;
        setMessages((data || []) as unknown as Message[]);
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching messages:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchMessages();
    return () => { cancelled = true; };
  }, [phoneKey, instanceId]);

  useEffect(() => {
    if (phoneVariants.length === 0) return;

    const phoneSet = new Set(phoneVariants);
    // Canal único por telefone — evita stale closure com telefone anterior
    const channelName = `embedded-chat-${phoneKey}`;

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
          // Strict instance filter for realtime
          const msgInstanceId = (newMsg as any).instance_id;
          if (instanceId) {
            if (msgInstanceId !== instanceId) return;
          } else {
            if (msgInstanceId) return;
          }
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            // Replace optimistic message if server confirms
            const optimisticIdx = prev.findIndex(m =>
              (m.metadata as any)?._optimistic &&
              m.content === newMsg.content &&
              m.direction === 'outbound' &&
              (m.status === 'sending' || m.status === 'sent')
            );
            if (optimisticIdx >= 0) {
              const updated = [...prev];
              updated[optimisticIdx] = newMsg;
              return updated;
            }
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
  }, [phoneKey, instanceId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !contactPhone) return;
    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setNewMessage("");

    // Optimistic: show message immediately
    const optimisticMsg: Message = {
      id: tempId,
      lead_id: null,
      phone_number: contactPhone,
      direction: 'outbound',
      content: messageText,
      media_url: null,
      media_type: null,
      status: 'sending',
      provider_id: null,
      message_type: 'text',
      metadata: { _tempId: tempId, _optimistic: true },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setIsSendingLocal(true);

    try {
      let leadQuery = supabase
        .from('posts')
        .select('id')
        .eq('telefone', contactPhone);
      if (instanceId) {
        leadQuery = leadQuery.eq('instance_id', instanceId);
      }
      const { data: leadData } = await leadQuery.maybeSingle();

      if (!leadData?.id) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
        toast.error("Lead não encontrado para este telefone");
        setIsSendingLocal(false);
        return;
      }

      const result = await sendMessage(leadData.id, messageText);
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, status: result.status === 'error' ? 'error' : 'sent', id: result.providerId || result.id || tempId }
          : m
      ));
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
    }
    setIsSendingLocal(false);
  }, [newMessage, contactPhone, sendMessage]);

  const handleRetry = useCallback(async (msg: Message) => {
    const tempId = msg.id;
    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sending' } : m));

    try {
      let leadQuery = supabase
        .from('posts')
        .select('id')
        .eq('telefone', contactPhone);
      if (instanceId) {
        leadQuery = leadQuery.eq('instance_id', instanceId);
      }
      const { data: leadData } = await leadQuery.maybeSingle();

      if (!leadData?.id) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
        return;
      }

      const result = await sendMessage(leadData.id, msg.content || '');
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, status: result.status === 'error' ? 'error' : 'sent', id: result.providerId || result.id || tempId }
          : m
      ));
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
    }
  }, [contactPhone, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, Message[]>);

  if (!contactPhone) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
        <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Sem telefone cadastrado</p>
        <p className="text-xs mt-1">Adicione um telefone para ver as mensagens</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-[#075e54] text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{contactName}</h3>
          <p className="text-xs text-white/70">{contactPhone}</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
            title="Apagar histórico de mensagens"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-red-700">Apagar todo o histórico desta conversa?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteHistory}
              disabled={isDeletingHistory}
              className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              {isDeletingHistory ? "Apagando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d4' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#e5ddd5'
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Carregando...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-xs">Nenhuma mensagem</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex justify-center mb-2">
                  <span className="bg-white/80 text-gray-600 text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                    {date}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {msgs.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs shadow-sm ${
                          msg.direction === 'outbound'
                            ? 'bg-[#dcf8c6] text-gray-800 rounded-br-none'
                            : 'bg-white text-gray-800 rounded-bl-none'
                        }`}
                      >
                        {msg.direction === 'inbound' && msg.metadata?.sender_name && (
                          <p className="text-[10px] text-primary font-medium mb-0.5">{msg.metadata.sender_name}</p>
                        )}
                        {MEDIA_TYPES_EMB.has(msg.message_type) && (
                          <EmbMediaContent message={msg} onLoaded={(id, url) => setMessages(prev => prev.map(m => m.id === id ? { ...m, media_url: url } : m))} />
                        )}
                        {msg.content && <p className="break-words whitespace-pre-wrap">{msg.content}</p>}
                        <div className={`flex items-center justify-end gap-1 mt-0.5 ${
                          msg.direction === 'outbound' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          <span className="text-[9px]">{formatTime(msg.created_at)}</span>
                          {msg.direction === 'outbound' && (
                            msg.status === 'sending'
                              ? <Loader2 className="h-2.5 w-2.5 animate-spin text-gray-400" />
                              : msg.status === 'error'
                              ? <AlertCircle className="h-2.5 w-2.5 text-red-500" />
                              : <CheckCheck className="h-2.5 w-2.5 text-[#53bdeb]" />
                          )}
                        </div>
                        {msg.status === 'error' && msg.direction === 'outbound' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRetry(msg); }}
                            className="flex items-center gap-1 mt-0.5 text-[9px] text-red-500 hover:text-red-700 font-medium"
                          >
                            <RotateCcw className="h-2 w-2" />
                            Falha. Toque para reenviar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="bg-[#f0f0f0] px-2 py-2 flex items-center gap-2 rounded-b-lg">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full hover:bg-purple-100"
          onClick={handleSendAiResponse}
          disabled={isSendingAiResponse || messages.length === 0}
          title="Enviar resposta de IA"
        >
          {isSendingAiResponse ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5 text-purple-600" />}
        </Button>
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-white border-0 rounded-full h-8 px-3 text-xs"
          disabled={isSendingLocal}
        />
        <Button
          size="icon"
          className="h-8 w-8 rounded-full bg-[#075e54] hover:bg-[#064e46]"
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || isSendingLocal}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
