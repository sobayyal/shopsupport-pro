import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Users table (agents, managers, admins)
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['agent', 'manager', 'admin'] }).notNull().default('agent'),
  isOnline: integer('is_online', { mode: 'boolean' }).notNull().default(false),
  lastSeen: text('last_seen').default('CURRENT_TIMESTAMP'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP')
});

// Customers table
export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shopifyCustomerId: text('shopify_customer_id').unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  location: text('location'),
  totalOrders: integer('total_orders').notNull().default(0),
  totalSpent: text('total_spent').notNull().default('0.00'),
  joinDate: text('join_date').default('CURRENT_TIMESTAMP'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP')
});

// Conversations table
export const conversations = sqliteTable('conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  assignedAgentId: integer('assigned_agent_id').references(() => users.id),
  status: text('status', { enum: ['waiting', 'active', 'resolved', 'closed'] }).notNull().default('waiting'),
  priority: text('priority', { enum: ['low', 'normal', 'high', 'urgent'] }).notNull().default('normal'),
  tags: text('tags').default('[]'), // JSON array
  subject: text('subject'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP')
});

// Messages table
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id),
  senderId: integer('sender_id').references(() => users.id),
  senderType: text('sender_type', { enum: ['customer', 'agent', 'system', 'ai'] }).notNull(),
  content: text('content').notNull(),
  messageType: text('message_type', { enum: ['text', 'image', 'file', 'system'] }).notNull().default('text'),
  metadata: text('metadata').default('{}'), // JSON object
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});

// Shopify orders table
export const shopifyOrders = sqliteTable('shopify_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  shopifyOrderId: text('shopify_order_id').notNull().unique(),
  orderNumber: text('order_number').notNull(),
  status: text('status').notNull(),
  totalPrice: text('total_price').notNull(),
  items: text('items').notNull(), // JSON array
  fulfillmentStatus: text('fulfillment_status'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP')
});

// AI suggestions table
export const aiSuggestions = sqliteTable('ai_suggestions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id),
  suggestion: text('suggestion').notNull(),
  confidence: real('confidence').notNull(),
  category: text('category').notNull(),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  messages: many(messages)
}));

export const customersRelations = relations(customers, ({ many }) => ({
  conversations: many(conversations),
  orders: many(shopifyOrders)
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  customer: one(customers, {
    fields: [conversations.customerId],
    references: [customers.id]
  }),
  assignedAgent: one(users, {
    fields: [conversations.assignedAgentId],
    references: [users.id]
  }),
  messages: many(messages),
  aiSuggestions: many(aiSuggestions)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id]
  })
}));

export const shopifyOrdersRelations = relations(shopifyOrders, ({ one }) => ({
  customer: one(customers, {
    fields: [shopifyOrders.customerId],
    references: [customers.id]
  })
}));

export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [aiSuggestions.conversationId],
    references: [conversations.id]
  })
}));
