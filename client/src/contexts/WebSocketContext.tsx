import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (message: WebSocketMessage) => void;
  subscribe: (type: string, callback: (data: any) => void) => () => void;
  joinConversation: (conversationId: number) => void;
  leaveConversation: (conversationId: number) => void;
  sendChatMessage: (conversationId: number, content: string) => void;
  startTyping: (conversationId: number) => void;
  stopTyping: (conversationId: number) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const subscribers = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    if (!token || !user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
      
      // Authenticate
      sendMessage({
        type: 'authenticate',
        token
      });
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Handle authentication response
        if (message.type === 'authenticated') {
          console.log('WebSocket authenticated');
        }
        
        // Notify subscribers
        const callbacks = subscribers.current.get(message.type);
        if (callbacks) {
          callbacks.forEach(callback => callback(message));
        }
        
        // Notify 'all' subscribers
        const allCallbacks = subscribers.current.get('*');
        if (allCallbacks) {
          allCallbacks.forEach(callback => callback(message));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      
      // Attempt reconnection
      if (reconnectAttempts.current < maxReconnectAttempts && token && user) {
        reconnectAttempts.current++;
        console.log(`Reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
        setTimeout(connect, Math.pow(2, reconnectAttempts.current) * 1000);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const disconnect = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
    reconnectAttempts.current = 0;
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  };

  const subscribe = (type: string, callback: (data: any) => void): (() => void) => {
    if (!subscribers.current.has(type)) {
      subscribers.current.set(type, new Set());
    }
    
    subscribers.current.get(type)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = subscribers.current.get(type);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          subscribers.current.delete(type);
        }
      }
    };
  };

  const joinConversation = (conversationId: number) => {
    sendMessage({
      type: 'join_conversation',
      conversationId
    });
  };

  const leaveConversation = (conversationId: number) => {
    sendMessage({
      type: 'leave_conversation',
      conversationId
    });
  };

  const sendChatMessage = (conversationId: number, content: string) => {
    sendMessage({
      type: 'send_message',
      conversationId,
      content,
      messageType: 'text'
    });
  };

  const startTyping = (conversationId: number) => {
    sendMessage({
      type: 'typing_start',
      conversationId
    });
  };

  const stopTyping = (conversationId: number) => {
    sendMessage({
      type: 'typing_stop',
      conversationId
    });
  };

  // Connect when user authenticates
  useEffect(() => {
    if (user && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const value: WebSocketContextType = {
    isConnected,
    sendMessage,
    subscribe,
    joinConversation,
    leaveConversation,
    sendChatMessage,
    startTyping,
    stopTyping,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
