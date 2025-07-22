import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { wsManager } from '@/lib/websocket';
import type { Message } from '@/types';

interface ChatWidgetProps {
  shopDomain: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
}

export default function ChatWidget({
  shopDomain,
  customerId,
  customerEmail,
  customerName
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: customerName || '',
    email: customerEmail || ''
  });

  useEffect(() => {
    // Connect to WebSocket when widget opens
    if (isOpen && !isConnected) {
      wsManager.connect();
      
      wsManager.on('connected', () => {
        setIsConnected(true);
        // Start a new conversation if needed
        startConversation();
      });

      wsManager.on('new_message', (data: any) => {
        if (data.message.conversationId === conversationId) {
          setMessages(prev => [...prev, data.message]);
        }
      });
    }

    return () => {
      if (isConnected) {
        wsManager.disconnect();
        setIsConnected(false);
      }
    };
  }, [isOpen, isConnected, conversationId]);

  const startConversation = async () => {
    try {
      // Create or find existing customer
      let customer;
      if (customerEmail) {
        const customerResponse = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customerInfo.name || 'Customer',
            email: customerEmail,
            shopifyCustomerId: customerId
          })
        });
        
        if (customerResponse.ok) {
          customer = await customerResponse.json();
        }
      }

      // Create new conversation
      const convResponse = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer?.id || 1, // Fallback for anonymous users
          status: 'waiting',
          priority: 'normal'
        })
      });

      if (convResponse.ok) {
        const conversation = await convResponse.json();
        setConversationId(conversation.id);
        wsManager.joinConversation(conversation.id);
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim() && conversationId) {
      wsManager.sendMessage(conversationId, newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleWidget = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans">
      {/* Chat Widget */}
      {isOpen && (
        <div className="mb-4 w-80 h-96 bg-white rounded-lg shadow-xl border border-slate-200 flex flex-col">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Chat Support</h3>
                <p className="text-sm opacity-90">We're here to help!</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <i className="fas fa-times"></i>
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 mx-auto">
                  <i className="fas fa-comment text-slate-400"></i>
                </div>
                <p>Start a conversation!</p>
                <p className="text-sm">We typically reply in a few minutes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.senderType === 'customer' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg text-sm ${
                        message.senderType === 'customer'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      <p>{message.content}</p>
                      {message.senderType === 'ai' && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          AI Assistant
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-slate-200">
            <div className="flex space-x-2">
              <Input
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage}
                disabled={!newMessage.trim() || !isConnected}
                size="sm"
              >
                <i className="fas fa-paper-plane"></i>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <Button
        onClick={toggleWidget}
        className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg"
        size="sm"
      >
        {isOpen ? (
          <i className="fas fa-times text-lg"></i>
        ) : (
          <i className="fas fa-comment text-lg"></i>
        )}
      </Button>
    </div>
  );
}
