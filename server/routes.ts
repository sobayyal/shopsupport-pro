import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { storage } from "./storage";
import { insertUserSchema, insertCustomerSchema, insertConversationSchema, insertMessageSchema } from "@shared/schema";
import { generateResponseSuggestion, categorizeMessage, generateAutoResponse } from "./services/openai";
import { shopifyService } from "./services/shopify";
import { shopifyAdminService } from "./services/shopify-admin";

interface WebSocketClient extends WebSocket {
  userId?: number;
  role?: string;
  conversationId?: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time chat
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws'
  });

  const clients = new Map<number, WebSocketClient>();

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocketClient, req) => {
    console.log('New WebSocket connection');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'authenticate':
            const user = await storage.getUser(data.userId);
            if (user) {
              ws.userId = data.userId;
              ws.role = user.role;
              clients.set(data.userId, ws);
              await storage.updateUserStatus(data.userId, true);
              
              ws.send(JSON.stringify({
                type: 'authenticated',
                user: { id: user.id, username: user.username, role: user.role }
              }));
            }
            break;

          case 'join_conversation':
            ws.conversationId = data.conversationId;
            break;

          case 'send_message':
            await handleSendMessage(data, ws);
            break;

          case 'typing':
            broadcastToConversation(data.conversationId, {
              type: 'typing',
              userId: ws.userId,
              isTyping: data.isTyping
            }, ws.userId);
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', async () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        await storage.updateUserStatus(ws.userId, false);
      }
    });
  });

  async function handleSendMessage(data: any, ws: WebSocketClient) {
    try {
      const message = await storage.createMessage({
        conversationId: data.conversationId,
        senderId: ws.userId || null,
        senderType: ws.userId ? 'agent' : 'customer',
        content: data.content,
        messageType: 'text',
        metadata: {}
      });

      // Get conversation and customer info for context
      const conversation = await storage.getConversation(data.conversationId);
      const customer = conversation ? await storage.getCustomer(conversation.customerId) : null;

      // Broadcast message to all clients in the conversation
      broadcastToConversation(data.conversationId, {
        type: 'new_message',
        message: {
          ...message,
          senderName: ws.userId ? (await storage.getUser(ws.userId))?.username : customer?.name
        }
      });

      // If message is from customer, generate AI suggestions
      if (!ws.userId && customer) {
        const suggestions = await generateResponseSuggestion(
          data.content,
          [],
          customer
        );

        if (suggestions.length > 0) {
          // Send AI suggestions to agents
          broadcastToAgents({
            type: 'ai_suggestions',
            conversationId: data.conversationId,
            suggestions
          });
        }

        // Try to generate auto-response for simple queries
        const autoResponse = await generateAutoResponse(data.content, customer);
        if (autoResponse) {
          const autoMessage = await storage.createMessage({
            conversationId: data.conversationId,
            senderId: null,
            senderType: 'ai',
            content: autoResponse,
            messageType: 'text',
            metadata: { isAutoResponse: true } as Record<string, any>
          });

          broadcastToConversation(data.conversationId, {
            type: 'new_message',
            message: {
              ...autoMessage,
              senderName: 'AI Assistant'
            }
          });
        }
      }

    } catch (error) {
      console.error('Error handling send message:', error);
    }
  }

  function broadcastToConversation(conversationId: number, message: any, excludeUserId?: number) {
    clients.forEach((client, userId) => {
      if (client.conversationId === conversationId && 
          userId !== excludeUserId &&
          client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  function broadcastToAgents(message: any) {
    clients.forEach((client, userId) => {
      if (client.role && ['agent', 'manager', 'admin'].includes(client.role) &&
          client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          role: user.role 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAgents();
      res.json(users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, isOnline: u.isOnline })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
    } catch (error) {
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  // Customer routes
  app.get("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Get Shopify orders for this customer
      const orders = await storage.getShopifyOrdersByCustomer(id);
      
      res.json({ ...customer, orders });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.json(customer);
    } catch (error) {
      res.status(400).json({ message: "Failed to create customer" });
    }
  });

  // Conversation routes
  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      const enriched = await Promise.all(conversations.map(async (conv) => {
        const customer = await storage.getCustomer(conv.customerId);
        const agent = conv.assignedAgentId ? await storage.getUser(conv.assignedAgentId) : null;
        const messages = await storage.getMessagesByConversation(conv.id);
        const lastMessage = messages[messages.length - 1];
        
        return {
          ...conv,
          customer,
          agent: agent ? { id: agent.id, username: agent.username } : null,
          lastMessage: lastMessage ? lastMessage.content : null,
          messageCount: messages.length
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const customer = await storage.getCustomer(conversation.customerId);
      const messages = await storage.getMessagesByConversation(id);
      
      res.json({
        ...conversation,
        customer,
        messages
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const conversationData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(conversationData);
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ message: "Failed to create conversation" });
    }
  });

  app.put("/api/conversations/:id/assign", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { agentId } = req.body;
      
      const conversation = await storage.assignConversation(conversationId, agentId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Notify agents about assignment
      broadcastToAgents({
        type: 'conversation_assigned',
        conversationId,
        agentId
      });

      res.json(conversation);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign conversation" });
    }
  });

  // Message routes
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messages = await storage.getMessagesByConversation(conversationId);
      
      const enriched = await Promise.all(messages.map(async (msg) => {
        if (msg.senderId) {
          const sender = await storage.getUser(msg.senderId);
          return {
            ...msg,
            senderName: sender?.username || 'Unknown'
          };
        }
        
        const conversation = await storage.getConversation(conversationId);
        const customer = conversation ? await storage.getCustomer(conversation.customerId) : null;
        
        return {
          ...msg,
          senderName: customer?.name || 'Customer'
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // AI routes
  app.post("/api/ai/suggestions", async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      
      const conversation = await storage.getConversation(conversationId);
      const customer = conversation ? await storage.getCustomer(conversation.customerId) : null;
      const recentMessages = await storage.getMessagesByConversation(conversationId);
      const context = recentMessages.slice(-5).map(m => m.content);
      
      const suggestions = await generateResponseSuggestion(message, context, customer);
      res.json({ suggestions });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  // Shopify integration routes
  app.post("/api/shopify/webhook", async (req, res) => {
    try {
      const signature = req.headers['x-shopify-hmac-sha256'] as string;
      const body = JSON.stringify(req.body);
      
      if (!shopifyService.verifyWebhook(body, signature)) {
        return res.status(401).json({ message: "Unauthorized webhook" });
      }

      // Handle different webhook types
      const topic = req.headers['x-shopify-topic'] as string;
      
      switch (topic) {
        case 'orders/create':
          await handleOrderCreate(req.body);
          break;
        case 'customers/create':
          await handleCustomerCreate(req.body);
          break;
        case 'orders/updated':
          await handleOrderUpdate(req.body);
          break;
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  async function handleOrderCreate(orderData: any) {
    try {
      // Find or create customer
      let customer = await storage.getCustomerByEmail(orderData.customer.email);
      
      if (!customer) {
        customer = await storage.createCustomer({
          shopifyCustomerId: orderData.customer.id.toString(),
          name: `${orderData.customer.first_name} ${orderData.customer.last_name}`,
          email: orderData.customer.email,
          phone: orderData.customer.phone,
          totalOrders: 1,
          totalSpent: orderData.total_price
        });
      } else {
        await storage.updateCustomer(customer.id, {
          totalOrders: customer.totalOrders + 1,
          totalSpent: (parseFloat(customer.totalSpent) + parseFloat(orderData.total_price)).toString()
        });
      }

      // Create order record
      await storage.createShopifyOrder({
        customerId: customer.id,
        shopifyOrderId: orderData.id.toString(),
        orderNumber: orderData.name,
        status: orderData.financial_status,
        totalPrice: orderData.total_price,
        items: orderData.line_items,
        fulfillmentStatus: orderData.fulfillment_status
      });
    } catch (error) {
      console.error('Error handling order create:', error);
    }
  }

  async function handleCustomerCreate(customerData: any) {
    try {
      const existing = await storage.getCustomerByEmail(customerData.email);
      if (!existing) {
        await storage.createCustomer({
          shopifyCustomerId: customerData.id.toString(),
          name: `${customerData.first_name} ${customerData.last_name}`,
          email: customerData.email,
          phone: customerData.phone,
          location: customerData.default_address?.country || '',
          totalOrders: customerData.orders_count || 0,
          totalSpent: customerData.total_spent || '0'
        });
      }
    } catch (error) {
      console.error('Error handling customer create:', error);
    }
  }

  async function handleOrderUpdate(orderData: any) {
    try {
      // Update order status and notify if needed
      // Implementation would depend on specific requirements
      console.log('Order updated:', orderData.name);
    } catch (error) {
      console.error('Error handling order update:', error);
    }
  }

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      const activeChats = conversations.filter(c => c.status === 'active').length;
      const waitingChats = conversations.filter(c => c.status === 'waiting').length;
      const resolvedToday = conversations.filter(c => 
        c.status === 'resolved' && 
        new Date(c.updatedAt).toDateString() === new Date().toDateString()
      ).length;
      
      const agents = await storage.getAgents();
      const onlineAgents = agents.filter(a => a.isOnline).length;

      res.json({
        activeChats,
        waitingChats,
        resolvedToday,
        onlineAgents,
        totalAgents: agents.length,
        avgResponseTime: '2.3m', // Mock data
        satisfaction: '94%' // Mock data
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Serve Shopify widget script
  app.get("/widget.js", (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/shopify-widget.js'));
  });

  // Serve integration instructions
  app.get("/setup", (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/embed-instructions.html'));
  });

  // Serve complete integration package
  app.get("/integration", (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/shopify-integration-complete.html'));
  });

  // Shopify webhook endpoints
  app.post("/api/webhooks/shopify/customer-created", async (req, res) => {
    try {
      const customer = req.body;
      console.log('Shopify customer created:', customer.id);
      await shopifyAdminService.syncCustomer(customer.id.toString());
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing customer created webhook:', error);
      res.status(500).send('Error');
    }
  });

  app.post("/api/webhooks/shopify/customer-updated", async (req, res) => {
    try {
      const customer = req.body;
      console.log('Shopify customer updated:', customer.id);
      await shopifyAdminService.syncCustomer(customer.id.toString());
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing customer updated webhook:', error);
      res.status(500).send('Error');
    }
  });

  app.post("/api/webhooks/shopify/order-created", async (req, res) => {
    try {
      const order = req.body;
      console.log('Shopify order created:', order.id);
      // Sync customer data when they place an order
      if (order.customer && order.customer.id) {
        await shopifyAdminService.syncCustomer(order.customer.id.toString());
      }
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing order created webhook:', error);
      res.status(500).send('Error');
    }
  });

  app.post("/api/webhooks/shopify/order-updated", async (req, res) => {
    try {
      const order = req.body;
      console.log('Shopify order updated:', order.id);
      // Sync customer data when order status changes
      if (order.customer && order.customer.id) {
        await shopifyAdminService.syncCustomer(order.customer.id.toString());
      }
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing order updated webhook:', error);
      res.status(500).send('Error');
    }
  });

  // Setup Shopify webhooks (call this once after deployment)
  app.post("/api/admin/setup-webhooks", async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      await shopifyAdminService.setupWebhooks(baseUrl);
      res.json({ message: 'Webhooks setup completed' });
    } catch (error) {
      console.error('Error setting up webhooks:', error);
      res.status(500).json({ message: 'Failed to setup webhooks' });
    }
  });

  // Get customer data from Shopify
  app.get("/api/shopify/customer/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const customer = await shopifyAdminService.getCustomerByEmail(email);
      
      if (customer) {
        // Sync to local storage
        await shopifyAdminService.syncCustomer(customer.id.toString());
        res.json(customer);
      } else {
        res.status(404).json({ message: 'Customer not found' });
      }
    } catch (error) {
      console.error('Error fetching Shopify customer:', error);
      res.status(500).json({ message: 'Failed to fetch customer data' });
    }
  });

  return httpServer;
}
