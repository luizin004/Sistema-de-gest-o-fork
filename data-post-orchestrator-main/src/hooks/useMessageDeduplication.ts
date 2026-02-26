import { useCallback, useRef } from 'react';

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

interface UseMessageDeduplicationProps {
  onDuplicateFound?: (tempId: string, realMessage: Message) => void;
  onTempMessageRemoved?: (tempId: string) => void;
}

export const useMessageDeduplication = ({
  onDuplicateFound,
  onTempMessageRemoved
}: UseMessageDeduplicationProps = {}) => {
  // Map de mensagens temporárias por providerId
  const tempMessagesByProviderId = useRef<Map<string, Message>>(new Map());
  
  // Map de providerId por chatId
  const providerIdsByChat = useRef<Map<string, Set<string>>>(new Map());

  // Adicionar mensagem temporária
  const addTempMessage = useCallback((message: Message) => {
    if (message.status !== 'sending' || !message.id.startsWith('temp-')) {
      return message;
    }

    // Se tiver providerId, adicionar ao map
    if (message.providerId) {
      tempMessagesByProviderId.current.set(message.providerId, message);
      
      // Adicionar providerId ao chat
      if (!providerIdsByChat.current.has(message.chatId)) {
        providerIdsByChat.current.set(message.chatId, new Set());
      }
      providerIdsByChat.current.get(message.chatId)!.add(message.providerId);
    }

    return message;
  }, []);

  // Verificar duplicata
  const checkDuplicate = useCallback((realMessage: Message): Message | null => {
    if (!realMessage.providerId) {
      return realMessage; // Sem providerId, não pode verificar duplicata
    }

    const tempMessage = tempMessagesByProviderId.current.get(realMessage.providerId);
    
    if (tempMessage) {
      // Encontrou duplicata!
      console.log('Duplicate found:', {
        tempId: tempMessage.id,
        realId: realMessage.id,
        providerId: realMessage.providerId
      });

      // Notificar sobre duplicata
      onDuplicateFound?.(tempMessage.id, realMessage);

      // Remover mensagem temporária
      removeTempMessage(tempMessage.id);

      // Retornar mensagem real
      return realMessage;
    }

    // Verificar duplicata por conteúdo e direção (fallback)
    return checkDuplicateByContent(realMessage);
  }, [onDuplicateFound]);

  // Verificar duplicata por conteúdo (fallback)
  const checkDuplicateByContent = useCallback((realMessage: Message): Message | null => {
    const chatProviderIds = providerIdsByChat.current.get(realMessage.chatId);
    
    if (!chatProviderIds) {
      return realMessage;
    }

    // Procurar mensagem temporária com mesmo conteúdo e tipo
    for (const providerId of chatProviderIds) {
      const tempMessage = tempMessagesByProviderId.current.get(providerId);
      
      if (tempMessage && 
          tempMessage.content === realMessage.content &&
          tempMessage.type === realMessage.type &&
          Math.abs(tempMessage.timestamp.getTime() - realMessage.timestamp.getTime()) < 5000) { // 5 segundos de diferença
        
        console.log('Duplicate found by content:', {
          tempId: tempMessage.id,
          realId: realMessage.id,
          content: realMessage.content
        });

        // Notificar sobre duplicata
        onDuplicateFound?.(tempMessage.id, realMessage);

        // Remover mensagem temporária
        removeTempMessage(tempMessage.id);

        // Retornar mensagem real
        return realMessage;
      }
    }

    return realMessage;
  }, [onDuplicateFound]);

  // Remover mensagem temporária
  const removeTempMessage = useCallback((tempId: string) => {
    // Encontrar mensagem temporária
    let tempMessage: Message | undefined;
    let providerIdToRemove: string | undefined;

    for (const [providerId, message] of tempMessagesByProviderId.current) {
      if (message.id === tempId) {
        tempMessage = message;
        providerIdToRemove = providerId;
        break;
      }
    }

    if (tempMessage && providerIdToRemove) {
      // Remover do map de providerId
      tempMessagesByProviderId.current.delete(providerIdToRemove);
      
      // Remover providerId do chat
      const chatProviderIds = providerIdsByChat.current.get(tempMessage.chatId);
      if (chatProviderIds) {
        chatProviderIds.delete(providerIdToRemove);
        
        // Se não tiver mais providerIds no chat, remover o chat
        if (chatProviderIds.size === 0) {
          providerIdsByChat.current.delete(tempMessage.chatId);
        }
      }

      // Notificar remoção
      onTempMessageRemoved?.(tempId);
    }
  }, [onTempMessageRemoved]);

  // Limpar mensagens temporárias de um chat
  const clearChatTempMessages = useCallback((chatId: string) => {
    const chatProviderIds = providerIdsByChat.current.get(chatId);
    
    if (chatProviderIds) {
      for (const providerId of chatProviderIds) {
        const tempMessage = tempMessagesByProviderId.current.get(providerId);
        if (tempMessage) {
          onTempMessageRemoved?.(tempMessage.id);
        }
        tempMessagesByProviderId.current.delete(providerId);
      }
      
      providerIdsByChat.current.delete(chatId);
    }
  }, [onTempMessageRemoved]);

  // Limpar todas as mensagens temporárias
  const clearAllTempMessages = useCallback(() => {
    for (const tempMessage of tempMessagesByProviderId.current.values()) {
      onTempMessageRemoved?.(tempMessage.id);
    }
    
    tempMessagesByProviderId.current.clear();
    providerIdsByChat.current.clear();
  }, [onTempMessageRemoved]);

  // Obter estatísticas
  const getStats = useCallback(() => {
    return {
      totalTempMessages: tempMessagesByProviderId.current.size,
      chatsWithTempMessages: providerIdsByChat.current.size,
      tempMessagesByChat: Array.from(providerIdsByChat.current.entries()).map(([chatId, providerIds]) => ({
        chatId,
        count: providerIds.size
      }))
    };
  }, []);

  return {
    addTempMessage,
    checkDuplicate,
    removeTempMessage,
    clearChatTempMessages,
    clearAllTempMessages,
    getStats
  };
};
