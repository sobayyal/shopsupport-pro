// manual-seed.js - Run this to manually seed your database
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function seedDatabase() {
    try {
        console.log('🔄 Starting manual database seeding...');

        // First, let's check what tables exist
        const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

        console.log('📋 Existing tables:', tables.map(t => t.table_name));

        // Check the structure of the users table
        if (tables.some(t => t.table_name === 'users')) {
            const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
      `;

            console.log('👤 Users table columns:', columns);

            // Determine which password column exists
            const hasPassword = columns.some(c => c.column_name === 'password');
            const hasPasswordHash = columns.some(c => c.column_name === 'password_hash');

            console.log('🔍 Password column check:');
            console.log('  - has "password":', hasPassword);
            console.log('  - has "password_hash":', hasPasswordHash);

            // Hash the password
            const adminPassword = await bcrypt.hash('admin123', 10);
            const agentPassword = await bcrypt.hash('agent123', 10);
            const managerPassword = await bcrypt.hash('manager123', 10);

            // Insert users based on which column exists
            if (hasPasswordHash) {
                console.log('🔐 Using password_hash column...');

                // Create admin user
                await sql`
          INSERT INTO users (username, email, password_hash, role, is_online)
          VALUES ('admin', 'admin@shopsupport.com', ${adminPassword}, 'admin', true)
          ON CONFLICT (username) DO UPDATE SET 
            password_hash = EXCLUDED.password_hash,
            email = EXCLUDED.email,
            role = EXCLUDED.role
        `;

                // Create agent user  
                await sql`
          INSERT INTO users (username, email, password_hash, role, is_online)
          VALUES ('agent1', 'agent1@shopsupport.com', ${agentPassword}, 'agent', false)
          ON CONFLICT (username) DO UPDATE SET 
            password_hash = EXCLUDED.password_hash,
            email = EXCLUDED.email,
            role = EXCLUDED.role
        `;

                // Create manager user
                await sql`
          INSERT INTO users (username, email, password_hash, role, is_online)
          VALUES ('manager1', 'manager1@shopsupport.com', ${managerPassword}, 'manager', false)
          ON CONFLICT (username) DO UPDATE SET 
            password_hash = EXCLUDED.password_hash,
            email = EXCLUDED.email,
            role = EXCLUDED.role
        `;

            } else if (hasPassword) {
                console.log('🔐 Using password column...');

                // Create admin user
                await sql`
          INSERT INTO users (username, email, password, role, is_online)
          VALUES ('admin', 'admin@shopsupport.com', ${adminPassword}, 'admin', true)
          ON CONFLICT (username) DO UPDATE SET 
            password = EXCLUDED.password,
            email = EXCLUDED.email,
            role = EXCLUDED.role
        `;

                // Create agent user  
                await sql`
          INSERT INTO users (username, email, password, role, is_online)
          VALUES ('agent1', 'agent1@shopsupport.com', ${agentPassword}, 'agent', false)
          ON CONFLICT (username) DO UPDATE SET 
            password = EXCLUDED.password,
            email = EXCLUDED.email,
            role = EXCLUDED.role
        `;

                // Create manager user
                await sql`
          INSERT INTO users (username, email, password, role, is_online)
          VALUES ('manager1', 'manager1@shopsupport.com', ${managerPassword}, 'manager', false)
          ON CONFLICT (username) DO UPDATE SET 
            password = EXCLUDED.password,
            email = EXCLUDED.email,
            role = EXCLUDED.role
        `;
            } else {
                console.error('❌ No password column found in users table!');
                return;
            }

            console.log('✅ Users created successfully!');
            console.log('👤 Login credentials:');
            console.log('   Admin - Username: admin, Password: admin123');
            console.log('   Agent - Username: agent1, Password: agent123');
            console.log('   Manager - Username: manager1, Password: manager123');

            // Verify users were created
            const userCount = await sql`SELECT COUNT(*) FROM users`;
            console.log(`📊 Total users in database: ${userCount[0].count}`);

        } else {
            console.error('❌ Users table does not exist! Please run database migration first.');
            console.log('💡 Run: cd server && npx drizzle-kit push');
        }

    } catch (error) {
        console.error('❌ Database seeding failed:', error);
    }
}

seedDatabase();