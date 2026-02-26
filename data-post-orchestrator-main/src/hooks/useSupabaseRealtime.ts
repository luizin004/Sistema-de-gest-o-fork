import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  chatId: string;
  content: string;
  type: 'user' | 'system' | 'media';
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';
  providerId?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video';
}

interface UseSupabaseRealtimeProps {
  chatId?: string;
  onNewMessage?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onMessageDelete?: (messageId: string) => void;
}

export const useSupabaseRealtime = ({
  chatId,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete
}: UseSupabaseRealtimeProps) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedChats = useRef<Set<string>>(new Set());

  // Limpar canal anterior
  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Inscrever em atualizações de mensagens
  const subscribeToMessages = useCallback(() => {
    cleanupChannel();

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'uazapi_chat_messages',
          filter: chatId ? `lead_id=eq.${chatId}` : undefined
        },
        (payload) => {
          console.log('Realtime message received:', payload);

          const { eventType, new: newRecord, old: oldRecord } = payload;

          switch (eventType) {
            case 'INSERT':
              if (newRecord && onNewMessage) {
                const message: Message = {
                  id: newRecord.id,
                  chatId: newRecord.chat_id,
                  content: newRecord.content,
                  type: newRecord.type,
                  timestamp: new Date(newRecord.created_at),
                  status: newRecord.status,
                  providerId: newRecord.provider_id,
                  mediaUrl: newRecord.media_url,
                  mediaType: newRecord.media_type
                };
                onNewMessage(message);
              }
              break;

            case 'UPDATE':
              if (newRecord && onMessageUpdate) {
                const message: Message = {
                  id: newRecord.id,
                  chatId: newRecord.chat_id,
                  content: newRecord.content,
                  type: newRecord.type,
                  timestamp: new Date(newRecord.created_at),
                  status: newRecord.status,
                  providerId: newRecord.provider_id,
                  mediaUrl: newRecord.media_url,
                  mediaType: newRecord.media_type
                };
                onMessageUpdate(message);
              }
              break;

            case 'DELETE':
              if (oldRecord && onMessageDelete) {
                onMessageDelete(oldRecord.id);
              }
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to chat messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error');
        }
      });

    channelRef.current = channel;
  }, [chatId, onNewMessage, onMessageUpdate, onMessageDelete, cleanupChannel]);

  // Inscrever quando chatId mudar
  useEffect(() => {
    if (chatId) {
      subscribeToMessages();
    }

    return cleanupChannel;
  }, [chatId, subscribeToMessages, cleanupChannel]);

  // Inscrever em múltiplos chats (para lista de contatos)
  const subscribeToMultipleChats = useCallback((chatIds: string[]) => {
    cleanupChannel();

    if (chatIds.length === 0) return;

    const channel = supabase
      .channel('multiple-chat-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'uazapi_chat_messages',
          filter: `lead_id=in.(${chatIds.join(',')})`
        },
        (payload) => {
          console.log('Multiple chat message received:', payload);
          
          const { eventType, new: newRecord } = payload;
          
          if (eventType === 'INSERT' && newRecord && onNewMessage) {
            const message: Message = {
              id: newRecord.id,
              chatId: newRecord.lead_id,
              content: newRecord.content,
              type: newRecord.direction === 'outbound' ? 'user' : 'system',
              timestamp: new Date(newRecord.created_at),
              status: newRecord.status as 'sending' | 'sent' | 'error',
              providerId: newRecord.provider_id,
              mediaUrl: newRecord.media_url,
              mediaType: newRecord.media_type
            };
            onNewMessage(message);
          }
        }
      )
      .subscribe((status) => {
        console.log('Multiple chats subscription status:', status);
      });

    channelRef.current = channel;
  }, [onNewMessage, cleanupChannel]);

  return {
    subscribeToMessages,
    subscribeToMultipleChats,
    cleanupChannel
  };
};
