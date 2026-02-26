import { useState, useEffect, useRef } from "react";
import { Send, MessageSquare, X, Download, Loader2 } from "lucide-react";
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

interface WhatsAppChatProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
  contactPhone: string | null;
}

const SUPABASE_FUNCTIONS_URL = 'https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1';
const SUPABASE_ANON_KEY_WA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts';
const MEDIA_TYPES_WA = new Set(['audio', 'ptt', 'image', 'video', 'document', 'sticker']);

const WaMediaContent = ({ message, onLoaded }: { message: Message; onLoaded: (id: string, url: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { media_url: mediaUrl, message_type: msgType } = message;

  const load = async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/process-whatsapp-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY_WA}` },
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
      return <img src={mediaUrl} alt="imagem" className="max-w-[240px] rounded-lg mt-1 cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')} />;
    if (msgType === 'video')
      return <video controls src={mediaUrl} className="max-w-[240px] rounded-lg mt-1" preload="metadata" />;
    if (msgType === 'document')
      return <a href={mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 mt-1 text-blue-600 underline text-xs"><Download className="w-3 h-3" /> Baixar documento</a>;
  }

  if (MEDIA_TYPES_WA.has(msgType)) {
    return (
      <button onClick={load} disabled={loading}
        className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-black/10 hover:bg-black/20 text-xs font-medium transition-colors">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
        {loading ? 'Carregando...' : error ? 'Tentar novamente' : `Carregar ${msgType === 'ptt' ? 'áudio' : msgType}`}
      </button>
    );
  }
  return null;
};

export const WhatsAppChat = ({ isOpen, onClose, contactName, contactPhone }: WhatsAppChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { sendMessage, isSending } = useMessageSender({
    onMessageSent: (msg) => {
      toast.success("Mensagem enviada!");
    },
    onMessageError: (msgId, err) => {
      toast.error("Erro ao enviar mensagem");
      console.error("Send error", err);
    }
  });

  // Get all possible phone format variations for querying
  const getPhoneVariants = (phone: string | null): string[] => {
    if (!phone) return [];
    const digits = phone.replace(/\D/g, '');
    const variants = new Set<string>();
    
    // Add the original digits
    variants.add(digits);
    
    // Add with/without country code 55
    if (digits.startsWith('55')) {
      variants.add(digits.slice(2)); // without 55
    } else {
      variants.add('55' + digits); // with 55
    }
    
    // Now handle the 9th digit variations for all current variants
    for (const v of [...variants]) {
      // For numbers with 55 prefix
      if (v.startsWith('55')) {
        const withoutCountry = v.slice(2);
        // If 11 digits after 55 (has 9), remove the 9
        if (withoutCountry.length === 11) {
          const ddd = withoutCountry.slice(0, 2);
          const rest = withoutCountry.slice(3); // skip the 9
          variants.add('55' + ddd + rest); // 55 + DDD + 8 digits = 12
          variants.add(ddd + rest); // DDD + 8 digits = 10
          variants.add(ddd + '9' + rest); // DDD + 9 + 8 digits = 11
        }
        // If 10 digits after 55 (no 9), add the 9
        if (withoutCountry.length === 10) {
          const ddd = withoutCountry.slice(0, 2);
          const rest = withoutCountry.slice(2);
          variants.add('55' + ddd + '9' + rest); // 55 + DDD + 9 + 8 digits = 13
          variants.add(ddd + '9' + rest); // DDD + 9 + 8 digits = 11
          variants.add(ddd + rest); // DDD + 8 digits = 10
        }
      } else {
        // Without 55 prefix
        // If 11 digits (DDD + 9 + 8), remove the 9
        if (v.length === 11) {
          const ddd = v.slice(0, 2);
          const rest = v.slice(3); // skip the 9
          variants.add(ddd + rest); // 10 digits
          variants.add('55' + ddd + rest); // 12 digits
          variants.add('55' + v); // 13 digits
        }
        // If 10 digits (DDD + 8), add the 9
        if (v.length === 10) {
          const ddd = v.slice(0, 2);
          const rest = v.slice(2);
          variants.add(ddd + '9' + rest); // 11 digits
          variants.add('55' + ddd + '9' + rest); // 13 digits
          variants.add('55' + v); // 12 digits
        }
      }
    }
    
    console.log("Phone variants for", phone, ":", [...variants]);
    return [...variants];
  };

  const phoneVariants = getPhoneVariants(contactPhone);

  // Fetch message history
  useEffect(() => {
    if (!isOpen || phoneVariants.length === 0) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        console.log("Fetching messages for phone variants:", phoneVariants);
        
        const { data, error } = await supabase
          .from('uazapi_chat_messages' as any)
          .select('*')
          .or(phoneVariants.map(p => `phone_number.eq.${p}`).join(','))
          .order('created_at', { ascending: true });

        if (error) throw error;
        console.log("Fetched messages:", data?.length);
        setMessages((data || []) as unknown as Message[]);
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [isOpen, contactPhone]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isOpen || phoneVariants.length === 0) return;

    const phoneSet = new Set(phoneVariants);
    const channel = supabase
      .channel(`whatsapp-chat-${contactPhone}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'uazapi_chat_messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (phoneSet.has(newMsg.phone_number)) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
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
  }, [isOpen, contactPhone]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !contactPhone) return;
    const messageText = newMessage.trim();
    setNewMessage("");
    try {
      // Find lead by phone to get leadId for uazapi-chat
      const { data: leadData } = await supabase
        .from('posts')
        .select('id')
        .eq('telefone', contactPhone)
        .maybeSingle();

      if (!leadData?.id) {
        toast.error("Lead não encontrado para este telefone");
        setNewMessage(messageText);
        return;
      }

      await sendMessage(leadData.id, messageText);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
      setNewMessage(messageText);
    }
  };

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

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, Message[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[380px] h-[550px] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-border animate-in slide-in-from-bottom-5 duration-300">
      {/* Header - WhatsApp style green */}
      <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold text-sm">
          {getInitials(contactName)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{contactName}</h3>
          <p className="text-xs text-white/70">{contactPhone || "Sem telefone"}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Chat area - WhatsApp style background */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d4' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#e5ddd5'
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Carregando mensagens...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs mt-1">Envie uma mensagem para iniciar a conversa</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex justify-center mb-3">
                  <span className="bg-white/80 text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm">
                    {date}
                  </span>
                </div>
                <div className="space-y-2">
                  {msgs.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm shadow-sm ${
                          msg.direction === 'outbound'
                            ? 'bg-[#dcf8c6] text-gray-800 rounded-br-none'
                            : 'bg-white text-gray-800 rounded-bl-none'
                        }`}
                      >
                        {msg.direction === 'inbound' && msg.metadata?.sender_name && (
                          <p className="text-xs text-primary font-medium mb-1">{msg.metadata.sender_name}</p>
                        )}
                        {MEDIA_TYPES_WA.has(msg.message_type) && (
                        <WaMediaContent message={msg} onLoaded={(id, url) => setMessages(prev => prev.map(m => m.id === id ? { ...m, media_url: url } : m))} />
                      )}
                      {msg.content && <p className="break-words whitespace-pre-wrap">{msg.content}</p>}
                        <p className={`text-[10px] mt-1 text-right ${
                          msg.direction === 'outbound' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          {formatTime(msg.created_at)}
                        </p>
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
      <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-white border-0 rounded-full h-10 px-4 text-sm"
          disabled={!contactPhone || isSending}
        />
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-[#075e54] hover:bg-[#064e46]"
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || !contactPhone || isSending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {!contactPhone && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-sm font-medium">Este contato não tem telefone cadastrado</p>
          </div>
        </div>
      )}
    </div>
  );
};
