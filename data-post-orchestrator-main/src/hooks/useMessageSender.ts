import { useState, useCallback } from 'react';
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

interface UseMessageSenderProps {
  onMessageSent?: (message: Message) => void;
  onMessageError?: (messageId: string, error: Error) => void;
}

export const useMessageSender = ({
  onMessageSent,
  onMessageError
}: UseMessageSenderProps = {}) => {
  const [sendingMessages, setSendingMessages] = useState<Set<string>>(new Set());

  // Gerar ID temporário
  const generateTempId = useCallback(() => {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Enviar mensagem via Supabase Edge Function
  const sendMessage = useCallback(async (
    chatId: string,
    content: string,
    type: 'user' | 'system' | 'media' = 'user',
    mediaUrl?: string,
    mediaType?: 'image' | 'audio' | 'video'
  ): Promise<Message> => {
    const tempId = generateTempId();
    const now = new Date();

    // Mensagem temporária (UI otimista)
    const tempMessage: Message = {
      id: tempId,
      chatId,
      content,
      type,
      timestamp: now,
      status: 'sending',
      mediaUrl,
      mediaType
    };

    // Adicionar ao estado de envio
    setSendingMessages(prev => new Set(prev).add(tempId));

    try {
      // Chamar Edge Function UAZAPI
      const { data, error } = await supabase.functions.invoke('uazapi-chat', {
        body: {
          action: 'send',
          leadId: chatId,
          message: content,
          tempId
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Remover do estado de envio
      setSendingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });

      // Mensagem confirmada pelo servidor
      const confirmedMessage: Message = {
        id: (data as any)?.id || tempId,
        chatId,
        content,
        type,
        timestamp: new Date((data as any)?.created_at || now.toISOString()),
        status: 'sent',
        providerId: (data as any)?.providerId,
        mediaUrl,
        mediaType
      };

      onMessageSent?.(confirmedMessage);
      return confirmedMessage;

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remover do estado de envio
      setSendingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });

      // Notificar erro
      onMessageError?.(tempId, error as Error);

      // Retornar mensagem com erro
      const errorMessage: Message = {
        ...tempMessage,
        status: 'error'
      };

      return errorMessage;
    }
  }, [generateTempId, onMessageSent, onMessageError]);

  // Retentar envio de mensagem
  const retryMessage = useCallback(async (message: Message): Promise<Message> => {
    if (message.status !== 'error') {
      throw new Error('Can only retry error messages');
    }

    return sendMessage(
      message.chatId,
      message.content,
      message.type,
      message.mediaUrl,
      message.mediaType
    );
  }, [sendMessage]);

  // Verificar se mensagem está sendo enviada
  const isSending = useCallback((messageId: string) => {
    return sendingMessages.has(messageId);
  }, [sendingMessages]);

  return {
    sendMessage,
    retryMessage,
    isSending,
    sendingMessages: Array.from(sendingMessages)
  };
};
