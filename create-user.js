// create-user.js - Run this to create a test user
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL);

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Hash password
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    // Create admin user
    await sql`
      INSERT INTO users (username, email, password_hash, role, is_online)
      VALUES ('admin', 'admin@shopsupport.com', ${passwordHash}, 'admin', false)
      ON CONFLICT (username) DO NOTHING
    `;
    
    console.log('✅ Admin user created!');
    console.log('Username: admin');
    console.log('Password: admin123');
    
    // Create manager user
    const managerHash = await bcrypt.hash('manager123', 10);
    await sql`
      INSERT INTO users (username, email, password_hash, role, is_online)
      VALUES ('manager1', 'manager1@shopsupport.com', ${managerHash}, 'manager', false)
      ON CONFLICT (username) DO NOTHING
    `;
    
    console.log('✅ Manager user created!');
    console.log('Username: manager1');
    console.log('Password: manager123');
    
  } catch (error) {
    console.error('Error creating user:', error);
  }
}

createTestUser();