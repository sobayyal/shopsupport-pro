import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { Message } from '@/types';

interface MessageListProps {
  messages: Message[];
  currentUserId: number;
  typingUsers?: string[];
}

export default function MessageList({ messages, currentUserId, typingUsers = [] }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  };

  const getAvatarColor = (senderId: number | null) => {
    if (!senderId) return 'bg-purple-500'; // Customer
    const colors = ['bg-primary', 'bg-blue-500', 'bg-green-500', 'bg-pink-500'];
    return colors[senderId % colors.length];
  };

  const isOwnMessage = (message: Message) => {
    return message.senderId === currentUserId;
  };

  const renderMessage = (message: Message, index: number) => {
    const isOwn = isOwnMessage(message);
    const isSystem = message.senderType === 'system' || message.senderType === 'ai';

    if (isSystem) {
      return (
        <div key={message.id} className="flex justify-center">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-w-md">
            <div className="flex items-center space-x-2 mb-2">
              <i className={`fas ${message.senderType === 'ai' ? 'fa-robot' : 'fa-info-circle'} text-primary`}></i>
              <span className="text-sm font-medium text-slate-700">
                {message.senderType === 'ai' ? 'AI Assistant' : 'System'}
              </span>
            </div>
            <div className="text-sm text-slate-600">
              {message.messageType === 'text' ? (
                <p>{message.content}</p>
              ) : (
                <div>
                  {/* Handle structured system messages */}
                  <pre className="whitespace-pre-wrap">{message.content}</pre>
                </div>
              )}
            </div>
            {message.metadata?.isAutoResponse && (
              <Badge variant="secondary" className="mt-2 text-xs">
                Auto Response
              </Badge>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={message.id} className={`flex space-x-3 ${isOwn ? 'justify-end' : ''}`}>
        {!isOwn && (
          <div className={`w-8 h-8 ${getAvatarColor(message.senderId || null)} rounded-full flex items-center justify-center text-white text-sm font-medium`}>
            {message.senderName ? getInitials(message.senderName) : 'C'}
          </div>
        )}
        
        <div className={`flex-1 ${isOwn ? 'max-w-md ml-auto' : 'max-w-md'}`}>
          <div className={`flex items-center space-x-2 mb-1 ${isOwn ? 'justify-end' : ''}`}>
            {!isOwn && (
              <span className="text-sm font-medium text-slate-900">
                {message.senderName || 'Customer'}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {format(new Date(message.createdAt), 'h:mm a')}
            </span>
            {isOwn && (
              <span className="text-sm font-medium text-slate-900">
                {message.senderName || 'You'}
              </span>
            )}
          </div>
          
          <div
            className={`rounded-lg p-3 ${
              isOwn
                ? 'bg-primary text-primary-foreground rounded-tr-none'
                : 'bg-slate-100 text-slate-800 rounded-tl-none'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>

        {isOwn && (
          <div className={`w-8 h-8 ${getAvatarColor(message.senderId || null)} rounded-full flex items-center justify-center text-white text-sm font-medium`}>
            {message.senderName ? getInitials(message.senderName) : 'A'}
          </div>
        )}
      </div>
    );
  };

  return (
    <ScrollArea className="h-full">
      <div ref={scrollRef} className="p-4 space-y-4 min-h-full">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 mx-auto">
                <i className="fas fa-comment text-slate-400"></i>
              </div>
              <p className="text-slate-500">No messages yet</p>
              <p className="text-sm text-slate-400">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map(renderMessage)
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex space-x-3">
            <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
              <span className="text-xs text-slate-600">...</span>
            </div>
            <div className="bg-slate-100 rounded-lg rounded-tl-none p-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
