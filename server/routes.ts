import { Express } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './database/init.js';
import * as schema from './database/schema.js';
import { eq, desc, and, or } from 'drizzle-orm';
import { openaiService } from './services/openai.js';
import { shopifyService } from './services/shopify.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT token
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

export function setupRoutes(app: Express) {
  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
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
        .set({ isOnline: true, lastSeen: new Date().toISOString() })
        .where(eq(schema.users.id, user[0].id));

      const token = jwt.sign(
        { id: user[0].id, username: user[0].username, role: user[0].role },
        JWT_SECRET,
        { expiresIn: '24h' }
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

  app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
      // Update user offline status
      await db.update(schema.users)
        .set({ isOnline: false, lastSeen: new Date().toISOString() })
        .where(eq(schema.users.id, req.user.id));

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  // User management routes
  app.get('/api/users', authenticateToken, async (req, res) => {
    try {
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

  app.post('/api/users', authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      const { username, email, password, role } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await db.insert(schema.users).values({
        username,
        email,
        passwordHash,
        role,
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
  app.get('/api/conversations', authenticateToken, async (req, res) => {
    try {
      const { status, assignedTo } = req.query;
      
      let whereConditions = [];
      
      if (status) {
        whereConditions.push(eq(schema.conversations.status, status as string));
      }
      
      if (assignedTo) {
        whereConditions.push(eq(schema.conversations.assignedAgentId, parseInt(assignedTo as string)));
      }
      
      // If user is an agent, only show their assigned conversations
      if (req.user.role === 'agent') {
        whereConditions.push(eq(schema.conversations.assignedAgentId, req.user.id));
      }

      const conversations = await db.select({
        id: schema.conversations.id,
        customerId: schema.conversations.customerId,
        assignedAgentId: schema.conversations.assignedAgentId,
        status: schema.conversations.status,
        priority: schema.conversations.priority,
        tags: schema.conversations.tags,
        subject: schema.conversations.subject,
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

  app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      
      const conversation = await db.select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId))
        .limit(1);

      if (conversation.length === 0) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Get customer details
      const customer = await db.select()
        .from(schema.customers)
        .where(eq(schema.customers.id, conversation[0].customerId))
        .limit(1);

      // Get messages
      const messages = await db.select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(schema.messages.createdAt);

      // Get customer orders if Shopify customer
      let orders = [];
      if (customer[0]?.shopifyCustomerId) {
        orders = await db.select()
          .from(schema.shopifyOrders)
          .where(eq(schema.shopifyOrders.customerId, customer[0].id))
          .orderBy(desc(schema.shopifyOrders.createdAt));
      }

      res.json({
        ...conversation[0],
        customer: customer[0],
        messages,
        orders
      });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ message: 'Failed to fetch conversation' });
    }
  });

  app.put('/api/conversations/:id/assign', authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      const conversationId = parseInt(req.params.id);
      const { agentId } = req.body;

      await db.update(schema.conversations)
        .set({ 
          assignedAgentId: agentId,
          status: 'active',
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.conversations.id, conversationId));

      res.json({ message: 'Conversation assigned successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to assign conversation' });
    }
  });

  app.put('/api/conversations/:id/status', authenticateToken, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { status } = req.body;

      await db.update(schema.conversations)
        .set({ 
          status,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.conversations.id, conversationId));

      res.json({ message: 'Status updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update status' });
    }
  });

  // Message routes
  app.post('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, messageType = 'text' } = req.body;

      const message = await db.insert(schema.messages).values({
        conversationId,
        senderId: req.user.id,
        senderType: 'agent',
        content,
        messageType,
        metadata: '{}',
        createdAt: new Date().toISOString()
      }).returning();

      // Update conversation updated time
      await db.update(schema.conversations)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(schema.conversations.id, conversationId));

      res.json(message[0]);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // AI suggestions route
  app.post('/api/conversations/:id/ai-suggestions', authenticateToken, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      
      // Get conversation context
      const messages = await db.select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(10);

      const context = messages.reverse().map(m => `${m.senderType}: ${m.content}`).join('\n');
      
      // Get AI suggestions
      const suggestions = await openai.generateResponseSuggestions(context);
      
      // Store suggestions in database
      for (const suggestion of suggestions) {
        await db.insert(schema.aiSuggestions).values({
          conversationId,
          suggestion: suggestion.text,
          confidence: suggestion.confidence,
          category: suggestion.category,
          used: false
        });
      }

      res.json(suggestions);
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      res.status(500).json({ message: 'Failed to generate suggestions' });
    }
  });

  // Customer widget API
  app.post('/api/widget/chat', async (req, res) => {
    try {
      const { customerData, message } = req.body;
      
      // Find or create customer
      let customer;
      if (customerData?.email) {
        const existingCustomer = await db.select()
          .from(schema.customers)
          .where(eq(schema.customers.email, customerData.email))
          .limit(1);

        if (existingCustomer.length > 0) {
          customer = existingCustomer[0];
        } else {
          const newCustomer = await db.insert(schema.customers).values({
            shopifyCustomerId: customerData.id?.toString(),
            name: customerData.name || 'Anonymous Customer',
            email: customerData.email,
            phone: customerData.phone,
            totalOrders: 0,
            totalSpent: '0.00'
          }).returning();
          customer = newCustomer[0];
        }
      } else {
        // Anonymous customer
        const newCustomer = await db.insert(schema.customers).values({
          name: 'Anonymous Customer',
          email: `anonymous-${Date.now()}@temp.com`,
          totalOrders: 0,
          totalSpent: '0.00'
        }).returning();
        customer = newCustomer[0];
      }

      // Create or find existing conversation
      const existingConversation = await db.select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.customerId, customer.id),
          or(
            eq(schema.conversations.status, 'waiting'),
            eq(schema.conversations.status, 'active')
          )
        ))
        .limit(1);

      let conversation;
      if (existingConversation.length > 0) {
        conversation = existingConversation[0];
      } else {
        const newConversation = await db.insert(schema.conversations).values({
          customerId: customer.id,
          status: 'waiting',
          priority: 'normal',
          tags: '[]',
          subject: message.substring(0, 50) + '...'
        }).returning();
        conversation = newConversation[0];
      }

      // Add customer message
      await db.insert(schema.messages).values({
        conversationId: conversation.id,
        senderId: null,
        senderType: 'customer',
        content: message,
        messageType: 'text',
        metadata: JSON.stringify(customerData || {})
      });

      // Generate auto-response if enabled
      const autoResponse = await openai.generateAutoResponse(message, customerData);
      if (autoResponse) {
        await db.insert(schema.messages).values({
          conversationId: conversation.id,
          senderId: null,
          senderType: 'ai',
          content: autoResponse,
          messageType: 'text',
          metadata: '{}'
        });
      }

      res.json({
        conversationId: conversation.id,
        status: 'success',
        autoResponse
      });
    } catch (error) {
      console.error('Error processing widget chat:', error);
      res.status(500).json({ message: 'Failed to process chat' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
      const activeChats = await db.select()
        .from(schema.conversations)
        .where(eq(schema.conversations.status, 'active'));

      const waitingChats = await db.select()
        .from(schema.conversations)
        .where(eq(schema.conversations.status, 'waiting'));

      const today = new Date().toISOString().split('T')[0];
      const resolvedToday = await db.select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.status, 'resolved'),
          eq(schema.conversations.updatedAt, today)
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
  app.post('/api/shopify/sync-customer/:customerId', authenticateToken, async (req, res) => {
    try {
      const { customerId } = req.params;
      const customerData = await shopifyService.getCustomer(customerId);
      
      if (customerData) {
        // Update or create customer
        await db.insert(schema.customers).values({
          shopifyCustomerId: customerData.id.toString(),
          name: `${customerData.first_name} ${customerData.last_name}`,
          email: customerData.email,
          phone: customerData.phone,
          totalOrders: customerData.orders_count || 0,
          totalSpent: customerData.total_spent || '0.00'
        }).onConflictDoUpdate({
          target: schema.customers.shopifyCustomerId,
          set: {
            name: `${customerData.first_name} ${customerData.last_name}`,
            email: customerData.email,
            phone: customerData.phone,
            totalOrders: customerData.orders_count || 0,
            totalSpent: customerData.total_spent || '0.00',
            updatedAt: new Date().toISOString()
          }
        });

        res.json({ message: 'Customer synced successfully' });
      } else {
        res.status(404).json({ message: 'Customer not found in Shopify' });
      }
    } catch (error) {
      console.error('Error syncing customer:', error);
      res.status(500).json({ message: 'Failed to sync customer' });
    }
  });

  // Serve static files
  app.get('/widget.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/shopify-widget.js'));
  });

  app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/embed-instructions.html'));
  });

  app.get('/integration', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/shopify-integration-complete.html'));
  });
}
