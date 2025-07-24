import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // ✅ Fixed: Use password_hash column
  role: text("role").notNull().default("agent"), // agent, manager, admin
  isOnline: boolean("is_online").notNull().default(false),
  lastSeen: timestamp("last_seen").defaultNow(), // ✅ Added missing column
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(), // ✅ Added missing column
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  shopifyCustomerId: text("shopify_customer_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  location: text("location"),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: text("total_spent").notNull().default("0"),
  joinDate: timestamp("join_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  assignedAgentId: integer("assigned_agent_id"),
  status: text("status").notNull().default("waiting"), // waiting, active, resolved, closed
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  tags: json("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: integer("sender_id"),
  senderType: text("sender_type").notNull(), // customer, agent, system, ai
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"), // text, image, file, system
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shopifyOrders = pgTable("shopify_orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  orderNumber: text("order_number").notNull(),
  status: text("status").notNull(),
  totalPrice: text("total_price").notNull(),
  items: json("items").$type<any[]>().default([]),
  fulfillmentStatus: text("fulfillment_status"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  assignedTo: integer("assigned_to"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema validation
export const insertUserSchema = createInsertSchema(users);
export const insertCustomerSchema = createInsertSchema(customers);
export const insertConversationSchema = createInsertSchema(conversations);
export const insertMessageSchema = createInsertSchema(messages);