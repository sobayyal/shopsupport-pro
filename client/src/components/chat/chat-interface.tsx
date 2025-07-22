import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MessageList from './message-list';
import MessageInput from './message-input';
import type { Conversation, User, Message, AISuggestion } from '@/types';

interface ChatInterfaceProps {
  conversation: Conversation;
  user: User;
  onCustomerClick: () => void;
}

export default function ChatInterface({ conversation, user, onCustomerClick }: ChatInterfaceProps) {
  const queryClient = useQueryClient();
  const { sendMessage, joinConversation, on } = useWebSocket();
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Join conversation for real-time updates
  useEffect(() => {
    joinConversation(conversation.id);
  }, [conversation.id, joinConversation]);

  // Listen for real-time messages and updates
  useEffect(() => {
    const unsubscribers = [
      on('new_message', (data) => {
        if (data.message.conversationId === conversation.id) {
          queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversation.id, 'messages'] });
        }
      }),
      on('ai_suggestions', (data) => {
        if (data.conversationId === conversation.id) {
          setAiSuggestions(data.suggestions);
        }
      }),
      on('typing', (data) => {
        if (data.conversationId === conversation.id) {
          if (data.isTyping) {
            setTypingUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
          } else {
            setTypingUsers(prev => prev.filter(id => id !== data.userId));
          }
        }
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [conversation.id, on, queryClient]);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/conversations', conversation.id, 'messages'],
    refetchInterval: false, // Rely on WebSocket for real-time updates
  });

  const assignMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await fetch(`/api/conversations/${conversation.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      if (!response.ok) throw new Error('Failed to assign conversation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      if (!response.ok) throw new Error('Failed to resolve conversation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  const handleSendMessage = (content: string) => {
    sendMessage(conversation.id, content);
    setAiSuggestions([]); // Clear suggestions after sending
  };

  const handleAssign = () => {
    if (user.role === 'admin' || user.role === 'manager') {
      assignMutation.mutate(user.id);
    }
  };

  const handleResolve = () => {
    resolveMutation.mutate();
  };

  const handleUseSuggestion = (suggestion: AISuggestion) => {
    handleSendMessage(suggestion.text);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-amber-500';
      case 'active': return 'bg-blue-500';
      case 'resolved': return 'bg-emerald-500';
      case 'closed': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="flex-1 bg-white flex flex-col">
      {/* Chat Header */}
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div 
              className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-medium cursor-pointer hover:opacity-80"
              onClick={onCustomerClick}
            >
              {conversation.customer ? getInitials(conversation.customer.name) : 'C'}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {conversation.customer?.name || 'Unknown Customer'}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-slate-500">
                <span>{conversation.customer?.email}</span>
                {conversation.customer?.location && (
                  <>
                    <span>•</span>
                    <span>{conversation.customer.location}</span>
                  </>
                )}
                <span>•</span>
                <div className="flex items-center space-x-1">
                  <span className={`w-2 h-2 ${getStatusColor(conversation.status)} rounded-full`}></span>
                  <span className="capitalize">{conversation.status}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!conversation.assignedAgentId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAssign}
                disabled={assignMutation.isPending}
              >
                <i className="fas fa-user-plus mr-2"></i>
                Assign to Me
              </Button>
            )}
            
            <Button variant="outline" size="sm">
              <i className="fas fa-tag mr-2"></i>
              Tag
            </Button>
            
            {conversation.status !== 'resolved' && (
              <Button
                onClick={handleResolve}
                disabled={resolveMutation.isPending}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <i className="fas fa-check mr-2"></i>
                Resolve
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList 
          messages={messages} 
          currentUserId={user.id}
          typingUsers={typingUsers}
        />
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="border-t border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start space-x-3">
            <i className="fas fa-robot text-blue-500 mt-1"></i>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 mb-2">AI Suggestions</p>
              <div className="space-y-2">
                {aiSuggestions.map((suggestion, index) => (
                  <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-slate-800 mb-2">{suggestion.text}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.category}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleUseSuggestion(suggestion)}
                        className="h-7 px-3 text-xs"
                      >
                        Use This
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Input */}
      <MessageInput 
        onSendMessage={handleSendMessage}
        conversationId={conversation.id}
        disabled={conversation.status === 'resolved' || conversation.status === 'closed'}
      />
    </div>
  );
}
