import { useState, useRef } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  conversationId: number;
  disabled?: boolean;
}

export default function MessageInput({ onSendMessage, conversationId, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { sendTyping } = useWebSocket();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const aiSuggestionMutation = useMutation({
    mutationFn: async (messageContent: string) => {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageContent, conversationId }),
      });
      if (!response.ok) throw new Error('Failed to get AI suggestions');
      return response.json();
    },
  });

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      handleStopTyping();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (value: string) => {
    setMessage(value);
    
    if (value.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        sendTyping(conversationId, true);
      }
      
      // Reset typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        handleStopTyping();
      }, 2000);
    } else {
      handleStopTyping();
    }
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      sendTyping(conversationId, false);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleGetAISuggestions = () => {
    if (message.trim()) {
      aiSuggestionMutation.mutate(message.trim());
    }
  };

  return (
    <div className="border-t border-slate-200 p-4">
      <div className="flex items-end space-x-3">
        <div className="flex-1">
          <Textarea
            placeholder={disabled ? "Conversation is closed" : "Type your message..."}
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={disabled}
            className="resize-none min-h-[60px]"
            rows={2}
          />
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm"
                disabled={disabled}
                title="Attach file"
              >
                <i className="fas fa-paperclip"></i>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm"
                disabled={disabled}
                title="Insert emoji"
              >
                <i className="fas fa-smile"></i>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGetAISuggestions}
                disabled={disabled || !message.trim() || aiSuggestionMutation.isPending}
                title="Get AI suggestions"
                className="text-blue-500 hover:text-blue-600"
              >
                <i className="fas fa-robot"></i>
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Press Enter to send</span>
              <Button 
                onClick={handleSend}
                disabled={disabled || !message.trim()}
                size="sm"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
