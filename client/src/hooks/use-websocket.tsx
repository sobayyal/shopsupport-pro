import { useEffect, useRef, useCallback } from 'react';
import { wsManager } from '@/lib/websocket';
import type { WebSocketMessage } from '@/types';

export function useWebSocket(userId?: number) {
  const isConnected = useRef(false);

  useEffect(() => {
    if (userId && !isConnected.current) {
      wsManager.connect(userId);
      isConnected.current = true;
    }

    return () => {
      if (isConnected.current) {
        wsManager.disconnect();
        isConnected.current = false;
      }
    };
  }, [userId]);

  const sendMessage = useCallback((conversationId: number, content: string) => {
    wsManager.sendMessage(conversationId, content);
  }, []);

  const joinConversation = useCallback((conversationId: number) => {
    wsManager.joinConversation(conversationId);
  }, []);

  const sendTyping = useCallback((conversationId: number, isTyping: boolean) => {
    wsManager.sendTyping(conversationId, isTyping);
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    wsManager.on(event, callback);
    
    return () => {
      wsManager.off(event, callback);
    };
  }, []);

  return {
    sendMessage,
    joinConversation,
    sendTyping,
    on
  };
}
