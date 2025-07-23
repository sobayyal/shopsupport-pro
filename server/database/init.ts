import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const sqlite = new Database(process.env.DATABASE_URL || 'shopsupport.db');
export const db = drizzle(sqlite, { schema });

export async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Run migrations
    migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
    
    // Create default admin user if doesn't exist
    const existingAdmin = await db.select()
      .from(schema.users)
      .where(eq(schema.users.role, 'admin'))
      .limit(1);
    
    if (existingAdmin.length === 0) {
      const adminPassword = await bcrypt.hash('admin123', 10);
      await db.insert(schema.users).values({
        username: 'admin',
        email: 'admin@shopsupport.com',
        passwordHash: adminPassword,
        role: 'admin',
        isOnline: true
      });
      
      console.log('✅ Default admin user created');
      console.log('👤 Username: admin');
      console.log('🔑 Password: admin123');
    }
    
    // Create sample agent if doesn't exist
    const existingAgent = await db.select()
      .from(schema.users)
      .where(eq(schema.users.username, 'agent1'))
      .limit(1);
    
    if (existingAgent.length === 0) {
      const agentPassword = await bcrypt.hash('agent123', 10);
      await db.insert(schema.users).values({
        username: 'agent1',
        email: 'agent1@shopsupport.com',
        passwordHash: agentPassword,
        role: 'agent',
        isOnline: false
      });
      
      console.log('✅ Sample agent created');
      console.log('👤 Username: agent1');
      console.log('🔑 Password: agent123');
    }
    
    // Create sample manager if doesn't exist
    const existingManager = await db.select()
      .from(schema.users)
      .where(eq(schema.users.username, 'manager1'))
      .limit(1);
    
    if (existingManager.length === 0) {
      const managerPassword = await bcrypt.hash('manager123', 10);
      await db.insert(schema.users).values({
        username: 'manager1',
        email: 'manager1@shopsupport.com',
        passwordHash: managerPassword,
        role: 'manager',
        isOnline: false
      });
      
      console.log('✅ Sample manager created');
      console.log('👤 Username: manager1');
      console.log('🔑 Password: manager123');
    }
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Helper function to create tables if they don't exist
export function createTables() {
  // Create users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'manager', 'admin')),
      is_online INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create customers table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopify_customer_id TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      location TEXT,
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_spent TEXT NOT NULL DEFAULT '0.00',
      join_date TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create conversations table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      assigned_agent_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'resolved', 'closed')),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      tags TEXT DEFAULT '[]',
      subject TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create messages table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      sender_id INTEGER REFERENCES users(id),
      sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system', 'ai')),
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create shopify_orders table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS shopify_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      shopify_order_id TEXT NOT NULL UNIQUE,
      order_number TEXT NOT NULL,
      status TEXT NOT NULL,
      total_price TEXT NOT NULL,
      items TEXT NOT NULL,
      fulfillment_status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create ai_suggestions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      suggestion TEXT NOT NULL,
      confidence REAL NOT NULL,
      category TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

import { eq } from 'drizzle-orm';
