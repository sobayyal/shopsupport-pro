import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/dashboard/sidebar';
import Header from '@/components/dashboard/header';
import StatsPanel from '@/components/dashboard/stats-panel';
import ConversationList from '@/components/dashboard/conversation-list';
import ChatInterface from '@/components/chat/chat-interface';
import CustomerSidebar from '@/components/dashboard/customer-sidebar';
import type { Conversation, Customer, DashboardStats } from '@/types';

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { on } = useWebSocket(user?.id);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerSidebarOpen, setIsCustomerSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      setLocation('/login');
    }
  }, [user, isLoading, setLocation]);

  // WebSocket event listeners
  useEffect(() => {
    const unsubscribers = [
      on('new_message', (data) => {
        // Refetch conversations to update last message
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      }),
      on('conversation_assigned', (data) => {
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [on]);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4 mx-auto animate-pulse">
            <i className="fas fa-headset text-white text-xl"></i>
          </div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (conversation.customer) {
      setSelectedCustomer(conversation.customer);
    }
  };

  const handleCustomerClick = () => {
    setIsCustomerSidebarOpen(true);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar 
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user}
          stats={stats}
        />
        
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Left Panel */}
            <div className="w-1/3 border-r border-slate-200 overflow-y-auto bg-white">
              <StatsPanel stats={stats} />
              <ConversationList 
                conversations={conversations}
                selectedConversation={selectedConversation}
                onConversationSelect={handleConversationSelect}
                onCustomerClick={handleCustomerClick}
              />
            </div>
            
            {/* Right Panel - Chat Interface */}
            <div className="flex-1 flex flex-col">
              {selectedConversation ? (
                <ChatInterface
                  conversation={selectedConversation}
                  user={user}
                  onCustomerClick={handleCustomerClick}
                />
              ) : (
                <div className="flex-1 bg-white flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                      <i className="fas fa-comments text-slate-400 text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No conversation selected</h3>
                    <p className="text-slate-500">Choose a conversation from the list to start chatting</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Customer Details Sidebar */}
      {selectedCustomer && (
        <CustomerSidebar
          customer={selectedCustomer}
          isOpen={isCustomerSidebarOpen}
          onClose={() => setIsCustomerSidebarOpen(false)}
        />
      )}
    </div>
  );
}
