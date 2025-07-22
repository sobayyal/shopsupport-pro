import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import type { Conversation } from '@/types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onConversationSelect: (conversation: Conversation) => void;
  onCustomerClick: () => void;
}

export default function ConversationList({
  conversations,
  selectedConversation,
  onConversationSelect,
  onCustomerClick
}: ConversationListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-amber-100 text-amber-700';
      case 'active': return 'bg-blue-100 text-blue-700';
      case 'resolved': return 'bg-emerald-100 text-emerald-700';
      case 'closed': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  };

  const getAvatarColor = (id: number) => {
    const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-pink-500', 'bg-indigo-500'];
    return colors[id % colors.length];
  };

  return (
    <div className="p-6 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Recent Conversations</h3>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
          View All
        </Button>
      </div>
      
      <div className="space-y-3">
        {conversations.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 mx-auto">
              <i className="fas fa-comments text-slate-400"></i>
            </div>
            <p className="text-slate-500">No conversations yet</p>
          </div>
        ) : (
          conversations.slice(0, 10).map((conversation) => (
            <div
              key={conversation.id}
              className={`flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                selectedConversation?.id === conversation.id
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-slate-50 hover:bg-slate-100'
              }`}
              onClick={() => onConversationSelect(conversation)}
            >
              <div 
                className={`w-10 h-10 ${getAvatarColor(conversation.customerId)} rounded-full flex items-center justify-center text-white text-sm font-medium cursor-pointer hover:opacity-80`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCustomerClick();
                }}
              >
                {conversation.customer ? getInitials(conversation.customer.name) : 'C'}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {conversation.customer?.name || 'Unknown Customer'}
                  </p>
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                  </span>
                </div>
                
                <p className="text-sm text-slate-600 truncate">
                  {conversation.lastMessage || 'No messages yet'}
                </p>
                
                <div className="flex items-center justify-between mt-1">
                  <Badge 
                    variant="secondary"
                    className={`text-xs ${getStatusColor(conversation.status)}`}
                  >
                    {conversation.status}
                  </Badge>
                  
                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <span>
                      {conversation.messageCount || 0} messages
                    </span>
                    {conversation.agent && (
                      <>
                        <span>•</span>
                        <span>{conversation.agent.username}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
