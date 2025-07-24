import { pgTable, text, integer, real, serial, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (agents, managers, admins)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(), // Make sure this line exists
  role: text('role', { enum: ['agent', 'manager', 'admin'] }).notNull().default('agent'),
  isOnline: boolean('is_online').notNull().default(false),
  lastSeen: timestamp('last_seen').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
// Customers table
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  shopifyCustomerId: text('shopify_customer_id').unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  location: text('location'),
  totalOrders: integer('total_orders').notNull().default(0),
  totalSpent: text('total_spent').notNull().default('0.00'),
  joinDate: timestamp('join_date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Conversations table
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  assignedAgentId: integer('assigned_agent_id').references(() => users.id),
  status: text('status', { enum: ['waiting', 'active', 'resolved', 'closed'] }).notNull().default('waiting'),
  priority: text('priority', { enum: ['low', 'normal', 'high', 'urgent'] }).notNull().default('normal'),
  tags: text('tags').default('[]'), // JSON array
  subject: text('subject'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Messages table
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id),
  senderId: integer('sender_id').references(() => users.id),
  senderType: text('sender_type', { enum: ['customer', 'agent', 'system', 'ai'] }).notNull(),
  content: text('content').notNull(),
  messageType: text('message_type', { enum: ['text', 'image', 'file', 'system'] }).notNull().default('text'),
  metadata: text('metadata').default('{}'), // JSON object
  createdAt: timestamp('created_at').defaultNow()
});

// Shopify orders table
export const shopifyOrders = pgTable('shopify_orders', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  shopifyOrderId: text('shopify_order_id').notNull().unique(),
  orderNumber: text('order_number').notNull(),
  status: text('status').notNull(),
  totalPrice: text('total_price').notNull(),
  items: text('items').notNull(), // JSON array
  fulfillmentStatus: text('fulfillment_status'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// AI suggestions table
export const aiSuggestions = pgTable('ai_suggestions', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id),
  suggestion: text('suggestion').notNull(),
  confidence: real('confidence').notNull(),
  category: text('category').notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow()
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