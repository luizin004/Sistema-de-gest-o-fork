import { useCallback, useRef } from 'react';

interface UseChatNotificationsProps {
  enabled?: boolean;
  soundEnabled?: boolean;
}

export const useChatNotifications = ({
  enabled = true,
  soundEnabled = true
}: UseChatNotificationsProps = {}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotificationTime = useRef<number>(0);

  // Inicializar áudio de notificação
  const initAudio = useCallback(() => {
    if (!audioRef.current && soundEnabled) {
      audioRef.current = new Audio('/notification-sound.mp3');
      audioRef.current.volume = 0.3;
    }
  }, [soundEnabled]);

  // Solicitar permissão de notificação
  const requestNotificationPermission = useCallback(async () => {
    if (!enabled || !('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  }, [enabled]);

  // Tocar som de notificação
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled || !audioRef.current) return;

    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        console.log('Error playing notification sound:', error);
      });
    } catch (error) {
      console.log('Error playing notification sound:', error);
    }
  }, [soundEnabled]);

  // Mostrar notificação do navegador
  const showBrowserNotification = useCallback((
    title: string,
    body?: string,
    icon?: string,
    onClick?: () => void
  ) => {
    if (!enabled) return;

    // Evitar spam de notificações (mínimo 2 segundos entre elas)
    const now = Date.now();
    if (now - lastNotificationTime.current < 2000) return;
    lastNotificationTime.current = now;

    requestNotificationPermission().then(granted => {
      if (granted) {
        const notification = new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          tag: 'chat-message',
          requireInteraction: false
        });

        if (onClick) {
          notification.onclick = () => {
            onClick();
            notification.close();
          };
        }

        // Auto-fechar após 5 segundos
        setTimeout(() => {
          notification.close();
        }, 5000);
      }
    });
  }, [enabled, requestNotificationPermission]);

  // Notificação de nova mensagem
  const notifyNewMessage = useCallback((
    contactName: string,
    message: string,
    onClick?: () => void
  ) => {
    if (!enabled) return;

    // Tocar som
    playNotificationSound();

    // Mostrar notificação do navegador
    showBrowserNotification(
      `Nova mensagem de ${contactName}`,
      message,
      undefined,
      onClick
    );
  }, [enabled, playNotificationSound, showBrowserNotification]);

  // Notificação de chat aberto
  const notifyChatOpened = useCallback((contactName: string) => {
    if (!enabled) return;

    showBrowserNotification(
      'Chat aberto',
      `Conversa com ${contactName} foi aberta`
    );
  }, [enabled, showBrowserNotification]);

  // Notificação de erro
  const notifyError = useCallback((error: string) => {
    if (!enabled) return;

    showBrowserNotification(
      'Erro no chat',
      error
    );
  }, [enabled, showBrowserNotification]);

  // Inicializar áudio quando o hook for montado
  useCallback(() => {
    initAudio();
  }, [initAudio]);

  return {
    notifyNewMessage,
    notifyChatOpened,
    notifyError,
    requestNotificationPermission,
    isSupported: 'Notification' in window
  };
};
