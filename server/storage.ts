import { 
  users, customers, conversations, messages, tickets, shopifyOrders,
  type User, type InsertUser,
  type Customer, type InsertCustomer,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type Ticket, type InsertTicket,
  type ShopifyOrder, type InsertShopifyOrder
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, isOnline: boolean): Promise<User | undefined>;
  getAgents(): Promise<User[]>;

  // Customers
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, updates: Partial<Customer>): Promise<Customer | undefined>;

  // Conversations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversations(): Promise<Conversation[]>;
  getConversationsByAgent(agentId: number): Promise<Conversation[]>;
  getConversationsByStatus(status: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  assignConversation(conversationId: number, agentId: number): Promise<Conversation | undefined>;

  // Messages
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Tickets
  getTicket(id: number): Promise<Ticket | undefined>;
  getTickets(): Promise<Ticket[]>;
  getTicketsByAgent(agentId: number): Promise<Ticket[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: number, updates: Partial<Ticket>): Promise<Ticket | undefined>;

  // Shopify Orders
  getShopifyOrder(id: number): Promise<ShopifyOrder | undefined>;
  getShopifyOrdersByCustomer(customerId: number): Promise<ShopifyOrder[]>;
  createShopifyOrder(order: InsertShopifyOrder): Promise<ShopifyOrder>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private customers: Map<number, Customer>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private tickets: Map<number, Ticket>;
  private shopifyOrders: Map<number, ShopifyOrder>;
  private currentUserId: number;
  private currentCustomerId: number;
  private currentConversationId: number;
  private currentMessageId: number;
  private currentTicketId: number;
  private currentOrderId: number;

  constructor() {
    this.users = new Map();
    this.customers = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.tickets = new Map();
    this.shopifyOrders = new Map();
    this.currentUserId = 1;
    this.currentCustomerId = 1;
    this.currentConversationId = 1;
    this.currentMessageId = 1;
    this.currentTicketId = 1;
    this.currentOrderId = 1;

    // Create default admin user
    this.createUser({
      username: "admin",
      email: "admin@shopsupport.com",
      password: "admin123",
      role: "admin",
      isOnline: true
    });

    // Create demo agent
    this.createUser({
      username: "john_doe",
      email: "john@shopsupport.com", 
      password: "agent123",
      role: "manager",
      isOnline: true
    });

    // Create some sample customers and conversations for testing
    this.seedSampleData();
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role || 'agent',
      isOnline: insertUser.isOnline || false,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserStatus(id: number, isOnline: boolean): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const updated = { ...user, isOnline };
      this.users.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async getAgents(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => 
      ['agent', 'manager', 'admin'].includes(user.role)
    );
  }

  // Customers
  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(customer => customer.email === email);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = this.currentCustomerId++;
    const customer: Customer = {
      ...insertCustomer,
      id,
      shopifyCustomerId: insertCustomer.shopifyCustomerId || null,
      phone: insertCustomer.phone || null,
      location: insertCustomer.location || null,
      totalOrders: insertCustomer.totalOrders || 0,
      totalSpent: insertCustomer.totalSpent || '0',
      joinDate: insertCustomer.joinDate || new Date(),
      createdAt: new Date(),
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: number, updates: Partial<Customer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (customer) {
      const updated = { ...customer, ...updates };
      this.customers.set(id, updated);
      return updated;
    }
    return undefined;
  }

  // Conversations
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getConversationsByAgent(agentId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(conv => 
      conv.assignedAgentId === agentId
    );
  }

  async getConversationsByStatus(status: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(conv => conv.status === status);
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.currentConversationId++;
    const conversation: Conversation = {
      ...insertConversation,
      id,
      status: insertConversation.status || 'waiting',
      assignedAgentId: insertConversation.assignedAgentId || null,
      priority: insertConversation.priority || 'normal',
      tags: insertConversation.tags ? [...insertConversation.tags] : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(id: number, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (conversation) {
      const updated = { ...conversation, ...updates, updatedAt: new Date() };
      this.conversations.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async assignConversation(conversationId: number, agentId: number): Promise<Conversation | undefined> {
    return this.updateConversation(conversationId, { 
      assignedAgentId: agentId,
      status: 'active'
    });
  }

  // Messages
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      ...insertMessage,
      id,
      senderId: insertMessage.senderId || null,
      messageType: insertMessage.messageType || 'text',
      metadata: insertMessage.metadata || null,
      createdAt: new Date(),
    };
    this.messages.set(id, message);

    // Update conversation timestamp
    const conversation = this.conversations.get(insertMessage.conversationId);
    if (conversation) {
      this.updateConversation(insertMessage.conversationId, { updatedAt: new Date() });
    }

    return message;
  }

  // Tickets
  async getTicket(id: number): Promise<Ticket | undefined> {
    return this.tickets.get(id);
  }

  async getTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getTicketsByAgent(agentId: number): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).filter(ticket => ticket.assignedTo === agentId);
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const id = this.currentTicketId++;
    const ticket: Ticket = {
      ...insertTicket,
      id,
      status: insertTicket.status || 'open',
      priority: insertTicket.priority || 'normal',
      assignedTo: insertTicket.assignedTo || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tickets.set(id, ticket);
    return ticket;
  }

  async updateTicket(id: number, updates: Partial<Ticket>): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    if (ticket) {
      const updated = { ...ticket, ...updates, updatedAt: new Date() };
      this.tickets.set(id, updated);
      return updated;
    }
    return undefined;
  }

  // Shopify Orders
  async getShopifyOrder(id: number): Promise<ShopifyOrder | undefined> {
    return this.shopifyOrders.get(id);
  }

  async getShopifyOrdersByCustomer(customerId: number): Promise<ShopifyOrder[]> {
    return Array.from(this.shopifyOrders.values())
      .filter(order => order.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createShopifyOrder(insertOrder: InsertShopifyOrder): Promise<ShopifyOrder> {
    const id = this.currentOrderId++;
    const order: ShopifyOrder = {
      ...insertOrder,
      id,
      items: insertOrder.items || null,
      fulfillmentStatus: insertOrder.fulfillmentStatus || null,
      createdAt: new Date(),
    };
    this.shopifyOrders.set(id, order);
    return order;
  }

  private async seedSampleData() {
    // Create sample customers
    const customer1 = await this.createCustomer({
      name: "Sarah Johnson",
      email: "sarah.johnson@email.com",
      phone: "+1-555-0123",
      location: "New York, USA",
      totalOrders: 5,
      totalSpent: "250.75"
    });

    const customer2 = await this.createCustomer({
      name: "Michael Chen",
      email: "michael.chen@email.com", 
      phone: "+1-555-0456",
      location: "California, USA",
      totalOrders: 12,
      totalSpent: "1,250.00"
    });

    const customer3 = await this.createCustomer({
      name: "Emma Wilson",
      email: "emma.wilson@email.com",
      phone: "+1-555-0789",
      location: "Texas, USA",
      totalOrders: 3,
      totalSpent: "89.99"
    });

    // Create sample conversations
    const conv1 = await this.createConversation({
      customerId: customer1.id,
      status: 'waiting',
      priority: 'normal',
      tags: ['order-inquiry']
    });

    const conv2 = await this.createConversation({
      customerId: customer2.id,
      status: 'active',
      priority: 'high', 
      assignedAgentId: 2,
      tags: ['refund-request', 'urgent']
    });

    const conv3 = await this.createConversation({
      customerId: customer3.id,
      status: 'waiting',
      priority: 'normal',
      tags: ['product-question']
    });

    // Create sample messages
    await this.createMessage({
      conversationId: conv1.id,
      senderId: null,
      senderType: 'customer',
      content: "Hi! I placed order #12345 yesterday but haven't received a confirmation email. Can you help me check the status?",
      messageType: 'text',
      metadata: {}
    });

    await this.createMessage({
      conversationId: conv2.id,
      senderId: null,
      senderType: 'customer', 
      content: "I received a damaged product and need a refund. The item was broken when it arrived.",
      messageType: 'text',
      metadata: {}
    });

    await this.createMessage({
      conversationId: conv2.id,
      senderId: 2,
      senderType: 'agent',
      content: "I'm sorry to hear about the damaged product. I'll be happy to help you with a refund. Can you please provide your order number?",
      messageType: 'text',
      metadata: {}
    });

    await this.createMessage({
      conversationId: conv3.id,
      senderId: null,
      senderType: 'customer',
      content: "What's the difference between the Pro and Premium plans?",
      messageType: 'text', 
      metadata: {}
    });

    // Create sample orders
    await this.createShopifyOrder({
      customerId: customer1.id,
      shopifyOrderId: "12345",
      orderNumber: "#1001",
      status: "confirmed",
      totalPrice: "89.99",
      items: [
        { name: "Wireless Headphones", quantity: 1, price: "89.99" }
      ] as any[],
      fulfillmentStatus: "pending"
    });

    await this.createShopifyOrder({
      customerId: customer2.id,
      shopifyOrderId: "12346",
      orderNumber: "#1002", 
      status: "delivered",
      totalPrice: "199.99",
      items: [
        { name: "Smart Watch", quantity: 1, price: "199.99" }
      ] as any[],
      fulfillmentStatus: "delivered"
    });
  }
}

export const storage = new MemStorage();
