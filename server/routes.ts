import { Express, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './database/init.js';
import * as schema from '../shared/schema.js';
import { eq, desc, and, or, gte } from 'drizzle-orm';
import { openaiService } from './services/openai.js';
import { shopifyService } from './services/shopify.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT Secret Key Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'ShopSupportPro2024!SecureJWTKey#RandomString$ForAuthentication';

// Validate JWT_SECRET exists
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not found in environment variables. Using fallback key for development.');
  console.warn('⚠️  For production, please set JWT_SECRET environment variable.');
}

// Extend Express Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

// Middleware to verify JWT token
function authenticateToken(req: AuthenticatedRequest, res: Response, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'Access token required',
      error: 'MISSING_TOKEN'
    });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(403).json({
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN'
      });
    }
    req.user = user;
    next();
  });
}

export function setupRoutes(app: Express) {
  // Authentication routes
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      const user = await db.select()
        .from(schema.users)
        .where(eq(schema.users.username, username))
        .limit(1);

      if (user.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user[0].passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Update user online status
      await db.update(schema.users)
        .set({
          isOnline: true,
          lastSeen: new Date()
        })
        .where(eq(schema.users.id, user[0].id));

      // Generate JWT token with secure settings
      const token = jwt.sign(
        {
          id: user[0].id,
          username: user[0].username,
          role: user[0].role,
          iat: Math.floor(Date.now() / 1000),
          jti: `${user[0].id}-${Date.now()}` // Unique token ID
        },
        JWT_SECRET,
        {
          expiresIn: '24h',
          issuer: 'ShopSupport-Pro',
          audience: 'ShopSupport-App'
        }
      );

      res.json({
        token,
        user: {
          id: user[0].id,
          username: user[0].username,
          email: user[0].email,
          role: user[0].role,
          isOnline: true
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Verify token endpoint
  app.get('/api/auth/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get fresh user data
      const user = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        role: schema.users.role,
        isOnline: schema.users.isOnline,
        lastSeen: schema.users.lastSeen
      })
        .from(schema.users)
        .where(eq(schema.users.id, req.user!.id))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        valid: true,
        user: user[0]
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({ message: 'Token verification failed' });
    }
  });

  // Refresh token endpoint
  app.post('/api/auth/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Generate new token with extended expiry
      const newToken = jwt.sign(
        {
          id: req.user!.id,
          username: req.user!.username,
          role: req.user!.role,
          iat: Math.floor(Date.now() / 1000),
          jti: `${req.user!.id}-${Date.now()}`
        },
        JWT_SECRET,
        {
          expiresIn: '24h',
          issuer: 'ShopSupport-Pro',
          audience: 'ShopSupport-App'
        }
      );

      // Update last seen
      await db.update(schema.users)
        .set({ lastSeen: new Date() })
        .where(eq(schema.users.id, req.user!.id));

      res.json({
        token: newToken,
        expiresIn: '24h'
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ message: 'Token refresh failed' });
    }
  });
  app.post('/api/auth/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await db.update(schema.users)
        .set({
          isOnline: false,
          lastSeen: new Date()
        })
        .where(eq(schema.users.id, req.user!.id));

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  // User management routes
  app.get('/api/users', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user!.role !== 'admin' && req.user!.role !== 'manager') {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      const users = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        role: schema.users.role,
        isOnline: schema.users.isOnline,
        lastSeen: schema.users.lastSeen
      }).from(schema.users);

      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user!.role !== 'admin' && req.user!.role !== 'manager') {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      const { username, email, password, role } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await db.insert(schema.users).values({
        username,
        email,
        passwordHash,
        role: role as 'agent' | 'manager' | 'admin',
        isOnline: false
      }).returning();

      res.json({
        id: newUser[0].id,
        username: newUser[0].username,
        email: newUser[0].email,
        role: newUser[0].role,
        isOnline: newUser[0].isOnline
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  // Conversation routes
  app.get('/api/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, assignedTo } = req.query;

      let whereConditions: any[] = [];

      if (status) {
        whereConditions.push(eq(schema.conversations.status, status as 'waiting' | 'active' | 'resolved' | 'closed'));
      }

      if (assignedTo) {
        whereConditions.push(eq(schema.conversations.assignedAgentId, parseInt(assignedTo as string)));
      }

      // If user is an agent, only show their assigned conversations
      if (req.user!.role === 'agent') {
        whereConditions.push(eq(schema.conversations.assignedAgentId, req.user!.id));
      }

      const conversations = await db.select({
        id: schema.conversations.id,
        customerId: schema.conversations.customerId,
        assignedAgentId: schema.conversations.assignedAgentId,
        status: schema.conversations.status,
        priority: schema.conversations.priority,
        tags: schema.conversations.tags,
        createdAt: schema.conversations.createdAt,
        updatedAt: schema.conversations.updatedAt,
        customerName: schema.customers.name,
        customerEmail: schema.customers.email,
        agentUsername: schema.users.username
      })
        .from(schema.conversations)
        .leftJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
        .leftJoin(schema.users, eq(schema.conversations.assignedAgentId, schema.users.id))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(schema.conversations.updatedAt));

      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ message: 'Failed to fetch conversations' });
    }
  });

  // Create new conversation
  app.post('/api/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { customerId, customerEmail, customerName, subject } = req.body;

      let customer;

      if (customerId) {
        // Use existing customer
        const existingCustomer = await db.select()
          .from(schema.customers)
          .where(eq(schema.customers.id, customerId))
          .limit(1);

        if (existingCustomer.length === 0) {
          return res.status(404).json({ message: 'Customer not found' });
        }
        customer = existingCustomer[0];
      } else if (customerEmail) {
        // Create or find customer by email
        let existingCustomer = await db.select()
          .from(schema.customers)
          .where(eq(schema.customers.email, customerEmail))
          .limit(1);

        if (existingCustomer.length === 0) {
          // Create new customer
          const newCustomer = await db.insert(schema.customers).values({
            name: customerName || 'Anonymous',
            email: customerEmail,
            totalOrders: 0,
            totalSpent: '0.00'
          }).returning();
          customer = newCustomer[0];
        } else {
          customer = existingCustomer[0];
        }
      } else {
        return res.status(400).json({ message: 'Customer ID or email required' });
      }

      // Create conversation
      const conversation = await db.insert(schema.conversations).values({
        customerId: customer.id,
        status: 'waiting',
        priority: 'normal'
      }).returning();

      res.json(conversation[0]);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ message: 'Failed to create conversation' });
    }
  });

  // Update conversation
  app.put('/api/conversations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { status, assignedAgentId, priority, tags } = req.body;

      // Check permissions
      if (req.user!.role === 'agent') {
        const conversation = await db.select()
          .from(schema.conversations)
          .where(eq(schema.conversations.id, conversationId))
          .limit(1);

        if (conversation.length === 0 || conversation[0].assignedAgentId !== req.user!.id) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const updated = await db.update(schema.conversations)
        .set({
          status: status as 'waiting' | 'active' | 'resolved' | 'closed',
          assignedAgentId,
          priority: priority as 'low' | 'normal' | 'high' | 'urgent',
          tags,
          updatedAt: new Date()
        })
        .where(eq(schema.conversations.id, conversationId))
        .returning();

      res.json(updated[0]);
    } catch (error) {
      console.error('Error updating conversation:', error);
      res.status(500).json({ message: 'Failed to update conversation' });
    }
  });

  // Assign conversation to agent
  app.post('/api/conversations/:id/assign', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { agentId } = req.body;

      if (req.user!.role !== 'admin' && req.user!.role !== 'manager') {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      await db.update(schema.conversations)
        .set({
          assignedAgentId: agentId,
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(schema.conversations.id, conversationId));

      res.json({ message: 'Conversation assigned successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to assign conversation' });
    }
  });

  // Update conversation status
  app.put('/api/conversations/:id/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { status } = req.body;

      await db.update(schema.conversations)
        .set({
          status: status as 'waiting' | 'active' | 'resolved' | 'closed',
          updatedAt: new Date()
        })
        .where(eq(schema.conversations.id, conversationId));

      res.json({ message: 'Status updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update status' });
    }
  });

  // Get conversation messages
  app.get('/api/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      const messages = await db.select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(schema.messages.createdAt);

      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  // Send message
  app.post('/api/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, messageType = 'text' } = req.body;

      const newMessage = await db.insert(schema.messages).values({
        conversationId,
        senderId: req.user!.id,
        senderType: 'agent' as 'customer' | 'agent' | 'system' | 'ai',
        content,
        messageType: messageType as 'text' | 'image' | 'file' | 'system',
        createdAt: new Date()
      }).returning();

      // Update conversation timestamp
      await db.update(schema.conversations)
        .set({
          updatedAt: new Date()
        })
        .where(eq(schema.conversations.id, conversationId));

      res.json(newMessage[0]);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // Customer message endpoint (for widget)
  app.post('/api/conversations/:id/customer-message', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, customerEmail, messageType = 'text' } = req.body;

      // Find customer by email
      const customer = await db.select()
        .from(schema.customers)
        .where(eq(schema.customers.email, customerEmail))
        .limit(1);

      if (customer.length === 0) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      const newMessage = await db.insert(schema.messages).values({
        conversationId,
        senderId: customer[0].id,
        senderType: 'customer' as 'customer' | 'agent' | 'system' | 'ai',
        content,
        messageType: messageType as 'text' | 'image' | 'file' | 'system',
        createdAt: new Date()
      }).returning();

      // Update conversation status to active and timestamp
      await db.update(schema.conversations)
        .set({
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(schema.conversations.id, conversationId));

      // Try to generate auto-response
      try {
        const autoResponse = await openaiService.generateAutoResponse(content, customer[0]);
        if (autoResponse) {
          // Send auto-response
          await db.insert(schema.messages).values({
            conversationId,
            senderId: null,
            senderType: 'ai' as 'customer' | 'agent' | 'system' | 'ai',
            content: autoResponse,
            messageType: 'text',
            createdAt: new Date()
          });
        }
      } catch (aiError) {
        console.error('Auto-response failed:', aiError);
      }

      res.json(newMessage[0]);
    } catch (error) {
      console.error('Error sending customer message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // AI suggestion endpoint
  app.post('/api/conversations/:id/ai-suggestions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      // Get conversation context
      const messages = await db.select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(10);

      const context = messages.reverse().map(m => `${m.senderType}: ${m.content}`).join('\n');

      const suggestions = await openaiService.generateResponseSuggestions(context);

      res.json({ suggestions });
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      res.status(500).json({ message: 'Failed to generate suggestions' });
    }
  });

  // Auto-response endpoint
  app.post('/api/ai/auto-response', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { customerMessage, customerData } = req.body;

      const response = await openaiService.generateAutoResponse(customerMessage, customerData);

      res.json({ response });
    } catch (error) {
      console.error('Error generating auto-response:', error);
      res.status(500).json({ message: 'AI service temporarily unavailable' });
    }
  });

  // Customer management
  app.get('/api/customers', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const customers = await db.select()
        .from(schema.customers)
        .orderBy(desc(schema.customers.createdAt));

      res.json(customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ message: 'Failed to fetch customers' });
    }
  });

  app.get('/api/customers/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const customerId = parseInt(req.params.id);

      const customer = await db.select()
        .from(schema.customers)
        .where(eq(schema.customers.id, customerId))
        .limit(1);

      if (customer.length === 0) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      res.json(customer[0]);
    } catch (error) {
      console.error('Error fetching customer:', error);
      res.status(500).json({ message: 'Failed to fetch customer' });
    }
  });

  app.put('/api/customers/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const customerId = parseInt(req.params.id);
      const updateData = req.body;

      const updated = await db.update(schema.customers)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(schema.customers.id, customerId))
        .returning();

      res.json(updated[0]);
    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({ message: 'Failed to update customer' });
    }
  });

  // Get customer orders
  app.get('/api/customers/:id/orders', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const customerId = parseInt(req.params.id);

      const customer = await db.select()
        .from(schema.customers)
        .where(eq(schema.customers.id, customerId))
        .limit(1);

      if (customer.length === 0) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      let orders: any[] = [];

      // Try to fetch from Shopify first
      if (customer[0].shopifyCustomerId) {
        try {
          orders = await shopifyService.getCustomerOrders(customer[0].shopifyCustomerId);
        } catch (shopifyError) {
          console.error('Shopify API error:', shopifyError);
        }
      }

      // Fallback to local database
      if (orders.length === 0) {
        orders = await db.select()
          .from(schema.shopifyOrders)
          .where(eq(schema.shopifyOrders.customerId, customerId));
      }

      res.json(orders);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  // Analytics endpoints
  app.get('/api/analytics/overview', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get conversations created in last 30 days
      const conversations = await db.select()
        .from(schema.conversations)
        .where(gte(schema.conversations.createdAt, thirtyDaysAgo));

      // Basic analytics
      const totalConversations = conversations.length;
      const resolvedConversations = conversations.filter(c => c.status === 'resolved').length;
      const activeConversations = conversations.filter(c => c.status === 'active').length;
      const waitingConversations = conversations.filter(c => c.status === 'waiting').length;

      const analytics = {
        totalConversations,
        resolvedConversations,
        activeConversations,
        waitingConversations,
        resolutionRate: totalConversations > 0 ? (resolvedConversations / totalConversations) * 100 : 0
      };

      res.json(analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get basic conversation stats
      const activeChats = await db.select()
        .from(schema.conversations)
        .where(eq(schema.conversations.status, 'active'));

      const waitingChats = await db.select()
        .from(schema.conversations)
        .where(eq(schema.conversations.status, 'waiting'));

      const resolvedToday = await db.select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.status, 'resolved'),
          gte(schema.conversations.updatedAt, today)
        ));

      const onlineAgents = await db.select()
        .from(schema.users)
        .where(and(
          eq(schema.users.isOnline, true),
          or(
            eq(schema.users.role, 'agent'),
            eq(schema.users.role, 'manager')
          )
        ));

      const totalAgents = await db.select()
        .from(schema.users)
        .where(or(
          eq(schema.users.role, 'agent'),
          eq(schema.users.role, 'manager')
        ));

      res.json({
        activeChats: activeChats.length,
        waitingChats: waitingChats.length,
        resolvedToday: resolvedToday.length,
        onlineAgents: onlineAgents.length,
        totalAgents: totalAgents.length,
        avgResponseTime: '2.3m',
        satisfaction: '94%'
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  // Shopify integration routes
  app.post('/api/shopify/sync-customer/:customerId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { customerId } = req.params;

      const customerData = await shopifyService.getCustomer(customerId);

      if (customerData) {
        // Update or create customer in local database
        const existingCustomer = await db.select()
          .from(schema.customers)
          .where(eq(schema.customers.shopifyCustomerId, customerId))
          .limit(1);

        if (existingCustomer.length > 0) {
          // Update existing customer
          await db.update(schema.customers)
            .set({
              name: `${customerData.first_name} ${customerData.last_name}`,
              email: customerData.email,
              phone: customerData.phone,
              totalOrders: customerData.orders_count || 0,
              totalSpent: customerData.total_spent || '0.00',
              updatedAt: new Date()
            })
            .where(eq(schema.customers.id, existingCustomer[0].id));
        } else {
          // Create new customer
          await db.insert(schema.customers).values({
            shopifyCustomerId: customerId,
            name: `${customerData.first_name} ${customerData.last_name}`,
            email: customerData.email,
            phone: customerData.phone,
            totalOrders: customerData.orders_count || 0,
            totalSpent: customerData.total_spent || '0.00'
          });
        }

        res.json({ message: 'Customer synced successfully', customer: customerData });
      } else {
        res.status(404).json({ message: 'Customer not found in Shopify' });
      }
    } catch (error) {
      console.error('Error syncing customer:', error);
      res.status(500).json({ message: 'Failed to sync customer' });
    }
  });

  // Test Shopify connection endpoint
  app.get('/api/shopify/test-connection', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Test by trying to fetch products (lighter call than customers)
      const products = await shopifyService.getProducts(1);

      res.json({
        connected: true,
        message: 'Shopify connection successful',
        shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
        hasProducts: products && products.length > 0
      });
    } catch (error) {
      res.status(500).json({
        connected: false,
        message: 'Shopify connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Webhook setup endpoint
  app.post('/api/admin/setup-webhooks', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const webhooks = [
        {
          topic: 'customers/create',
          address: `${baseUrl}/api/webhooks/customers/create`
        },
        {
          topic: 'customers/update',
          address: `${baseUrl}/api/webhooks/customers/update`
        },
        {
          topic: 'orders/create',
          address: `${baseUrl}/api/webhooks/orders/create`
        },
        {
          topic: 'orders/updated',
          address: `${baseUrl}/api/webhooks/orders/update`
        }
      ];

      const createdWebhooks = [];
      for (const webhook of webhooks) {
        try {
          const created = await shopifyService.createWebhook(webhook.topic, webhook.address);
          if (created) {
            createdWebhooks.push(created);
          }
        } catch (webhookError) {
          console.error(`Failed to create webhook for ${webhook.topic}:`, webhookError);
        }
      }

      res.json({
        message: 'Webhooks setup completed',
        webhooks: createdWebhooks,
        baseUrl
      });
    } catch (error) {
      console.error('Error setting up webhooks:', error);
      res.status(500).json({ message: 'Failed to setup webhooks' });
    }
  });

  // Get existing webhooks
  app.get('/api/admin/webhooks', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const webhooks = await shopifyService.getWebhooks();
      res.json({ webhooks });
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      res.status(500).json({ message: 'Failed to fetch webhooks' });
    }
  });

  // Webhook endpoints for Shopify
  app.post('/api/webhooks/customers/create', async (req: Request, res: Response) => {
    try {
      const customer = req.body;

      // Create customer in local database
      await db.insert(schema.customers).values({
        shopifyCustomerId: customer.id.toString(),
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        email: customer.email,
        phone: customer.phone || null,
        totalOrders: customer.orders_count || 0,
        totalSpent: customer.total_spent || '0.00'
      });

      console.log(`Customer created via webhook: ${customer.email}`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook customer create error:', error);
      res.status(500).send('Error');
    }
  });

  app.post('/api/webhooks/customers/update', async (req: Request, res: Response) => {
    try {
      const customer = req.body;

      // Update customer in local database
      await db.update(schema.customers)
        .set({
          name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
          email: customer.email,
          phone: customer.phone || null,
          totalOrders: customer.orders_count || 0,
          totalSpent: customer.total_spent || '0.00',
          updatedAt: new Date()
        })
        .where(eq(schema.customers.shopifyCustomerId, customer.id.toString()));

      console.log(`Customer updated via webhook: ${customer.email}`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook customer update error:', error);
      res.status(500).send('Error');
    }
  });

  app.post('/api/webhooks/orders/create', async (req: Request, res: Response) => {
    try {
      const order = req.body;

      // Find customer
      const customer = await db.select()
        .from(schema.customers)
        .where(eq(schema.customers.shopifyCustomerId, order.customer?.id.toString()))
        .limit(1);

      if (customer.length > 0) {
        // Create order record
        await db.insert(schema.shopifyOrders).values({
          customerId: customer[0].id,
          shopifyOrderId: order.id.toString(),
          orderNumber: order.name || order.order_number,
          status: order.financial_status,
          totalPrice: order.total_price,
          items: order.line_items || [], // ✅ Fixed: Pass array directly, not JSON string
          fulfillmentStatus: order.fulfillment_status
        });

        // Update customer stats
        await db.update(schema.customers)
          .set({
            totalOrders: customer[0].totalOrders + 1,
            totalSpent: order.customer?.total_spent || customer[0].totalSpent,
            updatedAt: new Date()
          })
          .where(eq(schema.customers.id, customer[0].id));
      }

      console.log(`Order created via webhook: ${order.name}`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook order create error:', error);
      res.status(500).send('Error');
    }
  });

  app.post('/api/webhooks/orders/update', async (req: Request, res: Response) => {
    try {
      const order = req.body;

      // Update order in local database
      await db.update(schema.shopifyOrders)
        .set({
          status: order.financial_status,
          fulfillmentStatus: order.fulfillment_status
          // ✅ Fixed: Removed updatedAt since it doesn't exist in shopifyOrders schema
        })
        .where(eq(schema.shopifyOrders.shopifyOrderId, order.id.toString()));

      console.log(`Order updated via webhook: ${order.name}`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook order update error:', error);
      res.status(500).send('Error');
    }
  });

  // Widget API endpoints
  app.post('/api/widget/init-chat', async (req: Request, res: Response) => {
    try {
      const { customerEmail, customerName, shopifyCustomerId } = req.body;

      if (!customerEmail) {
        return res.status(400).json({ message: 'Customer email required' });
      }

      // Find or create customer
      let customer = await db.select()
        .from(schema.customers)
        .where(eq(schema.customers.email, customerEmail))
        .limit(1);

      if (customer.length === 0) {
        // Create new customer
        const newCustomer = await db.insert(schema.customers).values({
          name: customerName || 'Anonymous Customer',
          email: customerEmail,
          shopifyCustomerId: shopifyCustomerId || null,
          totalOrders: 0,
          totalSpent: '0.00'
        }).returning();
        customer = newCustomer;
      }

      // Find or create active conversation
      let conversation = await db.select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.customerId, customer[0].id),
          or(
            eq(schema.conversations.status, 'waiting'),
            eq(schema.conversations.status, 'active')
          )
        ))
        .limit(1);

      if (conversation.length === 0) {
        // Create new conversation
        const newConversation = await db.insert(schema.conversations).values({
          customerId: customer[0].id,
          status: 'waiting',
          priority: 'normal'
        }).returning();
        conversation = newConversation;
      }

      res.json({
        conversationId: conversation[0].id,
        customer: customer[0]
      });
    } catch (error) {
      console.error('Error initializing chat:', error);
      res.status(500).json({ message: 'Failed to initialize chat' });
    }
  });

  // Get conversation messages for widget
  app.get('/api/widget/conversations/:id/messages', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      const messages = await db.select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(schema.messages.createdAt);

      res.json(messages);
    } catch (error) {
      console.error('Error fetching widget messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  // Static file routes
  app.get('/widget.js', (req, res) => {
    const widgetPath = path.join(__dirname, '../public/shopify-widget.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(widgetPath);
  });

  app.get('/setup', (req, res) => {
    const setupPath = path.join(__dirname, '../public/embed-instructions.html');
    res.sendFile(setupPath);
  });

  app.get('/integration', (req, res) => {
    const integrationPath = path.join(__dirname, '../public/shopify-integration-complete.html');
    res.sendFile(integrationPath);
  });

  // Health check with authentication status
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: !!process.env.DATABASE_URL,
      shopify: !!(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN),
      openai: !!process.env.OPENAI_API_KEY,
      jwt: !!process.env.JWT_SECRET,
      services: {
        database: process.env.DATABASE_URL ? 'connected' : 'missing',
        shopify: (process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN) ? 'configured' : 'not configured',
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
        jwt: process.env.JWT_SECRET ? 'configured' : 'using fallback'
      }
    });
  });

  // Root route
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'ShopSupport Pro API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/api/health',
        login: '/api/auth/login',
        widget: '/widget.js',
        setup: '/setup',
        integration: '/integration'
      }
    });
  });
}