export interface User {
  id: number;
  username: string;
  email: string;
  role: 'agent' | 'manager' | 'admin';
  isOnline: boolean;
}

export interface Customer {
  id: number;
  shopifyCustomerId?: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  totalOrders: number;
  totalSpent: string;
  joinDate: string;
  orders?: ShopifyOrder[];
}

export interface Conversation {
  id: number;
  customerId: number;
  assignedAgentId?: number;
  status: 'waiting' | 'active' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  agent?: { id: number; username: string };
  lastMessage?: string;
  messageCount?: number;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId?: number;
  senderType: 'customer' | 'agent' | 'system' | 'ai';
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  metadata: Record<string, any>;
  createdAt: string;
  senderName?: string;
}

export interface ShopifyOrder {
  id: number;
  customerId: number;
  shopifyOrderId: string;
  orderNumber: string;
  status: string;
  totalPrice: string;
  items: any[];
  fulfillmentStatus?: string;
  createdAt: string;
}

export interface AISuggestion {
  text: string;
  confidence: number;
  category: string;
}

export interface DashboardStats {
  activeChats: number;
  waitingChats: number;
  resolvedToday: number;
  onlineAgents: number;
  totalAgents: number;
  avgResponseTime: string;
  satisfaction: string;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}
