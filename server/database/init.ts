import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../shared/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import dotenv from "dotenv"
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Initialize Neon database connection
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

export async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');

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
        password: adminPassword,
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
        password: agentPassword,
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
        password: managerPassword,
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