import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { db } from './database/init.js';
import * as schema from './database/schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  role?: string;
  username?: string;
  conversationId?: number;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

class WebSocketManager {
  private clients: Map<number, AuthenticatedWebSocket> = new Map();
  private conversationClients: Map<number, Set<AuthenticatedWebSocket>> = new Map();

  setupWebSocket(wss: WebSocketServer) {
    wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      console.log('New WebSocket connection');

      ws.on('message', async (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    switch (message.type) {
      case 'authenticate':
        await this.handleAuthentication(ws, message);
        break;
      
      case 'join_conversation':
        await this.handleJoinConversation(ws, message);
        break;
      
      case 'leave_conversation':
        this.handleLeaveConversation(ws, message);
        break;
      
      case 'send_message':
        await this.handleSendMessage(ws, message);
        break;
      
      case 'typing_start':
        this.handleTypingStart(ws, message);
        break;
      
      case 'typing_stop':
        this.handleTypingStop(ws, message);
        break;
      
      case 'customer_message':
        await this.handleCustomerMessage(ws, message);
        break;
      
      case 'update_status':
        await this.handleStatusUpdate(ws, message);
        break;
      
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private async handleAuthentication(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    try {
      const { token } = message;
      
      if (!token) {
        return this.sendError(ws, 'Token required');
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Verify user exists and is active
      const user = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, decoded.id))
        .limit(1);

      if (user.length === 0) {
        return this.sendError(ws, 'Invalid user');
      }

      ws.userId = decoded.id;
      ws.role = decoded.role;
      ws.username = decoded.username;

      // Store client connection
      this.clients.set(decoded.id, ws);

      // Update user online status
      await db.update(schema.users)
        .set({ isOnline: true, lastSeen: new Date().toISOString() })
        .where(eq(schema.users.id, decoded.id));

      this.sendMessage(ws, {
        type: 'authenticated',
        user: {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role
        }
      });

      // Notify other agents about online status
      this.broadcastToAgents({
        type: 'agent_status_changed',
        userId: decoded.id,
        username: decoded.username,
        isOnline: true
      }, decoded.id);

      console.log(`User ${decoded.username} authenticated via WebSocket`);
    } catch (error) {
      console.error('Authentication error:', error);
      this.sendError(ws, 'Authentication failed');
    }
  }

  private async handleJoinConversation(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.userId) {
      return this.sendError(ws, 'Not authenticated');
    }

    const { conversationId } = message;
    
    if (!conversationId) {
      return this.sendError(ws, 'Conversation ID required');
    }

    // Verify access to conversation
    const conversation = await db.select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .limit(1);

    if (conversation.length === 0) {
      return this.sendError(ws, 'Conversation not found');
    }

    // Check permissions
    if (ws.role === 'agent' && conversation[0].assignedAgentId !== ws.userId) {
      return this.sendError(ws, 'Not assigned to this conversation');
    }

    ws.conversationId = conversationId;

    // Add to conversation clients
    if (!this.conversationClients.has(conversationId)) {
      this.conversationClients.set(conversationId, new Set());
    }
    this.conversationClients.get(conversationId)!.add(ws);

    this.sendMessage(ws, {
      type: 'joined_conversation',
      conversationId
    });

    // Notify other participants
    this.broadcastToConversation(conversationId, {
      type: 'agent_joined',
      agentId: ws.userId,
      agentName: ws.username
    }, ws.userId);
  }

  private handleLeaveConversation(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { conversationId } = message;
    
    if (conversationId && this.conversationClients.has(conversationId)) {
      this.conversationClients.get(conversationId)!.delete(ws);
      
      if (this.conversationClients.get(conversationId)!.size === 0) {
        this.conversationClients.delete(conversationId);
      }
    }

    ws.conversationId = undefined;

    this.sendMessage(ws, {
      type: 'left_conversation',
      conversationId
    });
  }

  private async handleSendMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.userId || !ws.conversationId) {
      return this.sendError(ws, 'Not authenticated or not in conversation');
    }

    const { content, messageType = 'text' } = message;

    try {
      // Save message to database
      const newMessage = await db.insert(schema.messages).values({
        conversationId: ws.conversationId,
        senderId: ws.userId,
        senderType: 'agent',
        content,
        messageType,
        metadata: '{}',
        createdAt: new Date().toISOString()
      }).returning();

      // Update conversation timestamp
      await db.update(schema.conversations)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(schema.conversations.id, ws.conversationId));

      // Broadcast to conversation participants
      this.broadcastToConversation(ws.conversationId, {
        type: 'new_message',
        message: {
          ...newMessage[0],
          senderName: ws.username
        }
      });

      // Send confirmation to sender
      this.sendMessage(ws, {
        type: 'message_sent',
        messageId: newMessage[0].id
      });

    } catch (error) {
      console.error('Error sending message:', error);
      this.sendError(ws, 'Failed to send message');
    }
  }

  private handleTypingStart(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.conversationId || !ws.userId) return;

    this.broadcastToConversation(ws.conversationId, {
      type: 'typing_start',
      userId: ws.userId,
      username: ws.username
    }, ws.userId);
  }

  private handleTypingStop(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.conversationId || !ws.userId) return;

    this.broadcastToConversation(ws.conversationId, {
      type: 'typing_stop',
      userId: ws.userId,
      username: ws.username
    }, ws.userId);
  }

  private async handleCustomerMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    // This handles messages from the widget (customers)
    const { conversationId, content, customerData } = message;

    try {
      // Save customer message
      await db.insert(schema.messages).values({
        conversationId,
        senderId: null,
        senderType: 'customer',
        content,
        messageType: 'text',
        metadata: JSON.stringify(customerData || {})
      });

      // Update conversation timestamp
      await db.update(schema.conversations)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(schema.conversations.id, conversationId));

      // Broadcast to agents
      this.broadcastToConversation(conversationId, {
        type: 'new_customer_message',
        message: {
          conversationId,
          content,
          senderType: 'customer',
          createdAt: new Date().toISOString()
        }
      });

      // Notify all agents about new message
      this.broadcastToAgents({
        type: 'new_conversation_activity',
        conversationId,
        activity: 'new_message'
      });

    } catch (error) {
      console.error('Error handling customer message:', error);
    }
  }

  private async handleStatusUpdate(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (!ws.userId) return;

    const { conversationId, status } = message;

    try {
      await db.update(schema.conversations)
        .set({ 
          status,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.conversations.id, conversationId));

      // Broadcast status update
      this.broadcastToAgents({
        type: 'conversation_status_updated',
        conversationId,
        status,
        updatedBy: ws.username
      });

    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  private handleDisconnection(ws: AuthenticatedWebSocket) {
    if (ws.userId) {
      console.log(`User ${ws.username} disconnected`);
      
      // Remove from clients
      this.clients.delete(ws.userId);

      // Remove from conversation clients
      if (ws.conversationId && this.conversationClients.has(ws.conversationId)) {
        this.conversationClients.get(ws.conversationId)!.delete(ws);
      }

      // Update offline status
      db.update(schema.users)
        .set({ isOnline: false, lastSeen: new Date().toISOString() })
        .where(eq(schema.users.id, ws.userId))
        .catch(console.error);

      // Notify other agents
      this.broadcastToAgents({
        type: 'agent_status_changed',
        userId: ws.userId,
        username: ws.username,
        isOnline: false
      }, ws.userId);
    }
  }

  private sendMessage(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      error
    });
  }

  private broadcastToConversation(conversationId: number, message: any, excludeUserId?: number) {
    const clients = this.conversationClients.get(conversationId);
    if (!clients) return;

    clients.forEach(client => {
      if (excludeUserId && client.userId === excludeUserId) return;
      this.sendMessage(client, message);
    });
  }

  private broadcastToAgents(message: any, excludeUserId?: number) {
    this.clients.forEach((client, userId) => {
      if (excludeUserId && userId === excludeUserId) return;
      if (client.role && ['agent', 'manager', 'admin'].includes(client.role)) {
        this.sendMessage(client, message);
      }
    });
  }

  // Public methods for external use
  public notifyNewConversation(conversationId: number) {
    this.broadcastToAgents({
      type: 'new_conversation',
      conversationId
    });
  }

  public notifyConversationAssigned(conversationId: number, agentId: number, agentName: string) {
    this.broadcastToAgents({
      type: 'conversation_assigned',
      conversationId,
      agentId,
      agentName
    });
  }

  public sendToUser(userId: number, message: any) {
    const client = this.clients.get(userId);
    if (client) {
      this.sendMessage(client, message);
    }
  }

  public getOnlineAgents(): number[] {
    return Array.from(this.clients.keys()).filter(userId => {
      const client = this.clients.get(userId);
      return client?.role && ['agent', 'manager', 'admin'].includes(client.role);
    });
  }
}

export const wsManager = new WebSocketManager();

export function setupWebSocket(wss: WebSocketServer) {
  wsManager.setupWebSocket(wss);
}
