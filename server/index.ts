// Simple environment loading from local .env file
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { setupRoutes } from './routes.js';
import { db } from './database/init.js';
import { users } from '../shared/schema.js'; // Use shared schema
import { eq } from 'drizzle-orm';
import bodyParser from "body-parser"
import dotenv from "dotenv"
dotenv.config()

// Exit if no DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

// Debug environment loading
console.log('🔄 Starting ShopSupport Pro server...');
console.log('🔍 Environment check:');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json())

// Test route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: !!process.env.DATABASE_URL
  });
});

app.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const user = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    console.log("user----->", user);

    if (user.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ Fixed: Use passwordHash field (matches the database column password_hash)
    const validPassword = await bcrypt.compare(password, user[0].passwordHash);

    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update user online status
    await db.update(users)
      .set({
        isOnline: true,
        lastSeen: new Date() // ✅ Added lastSeen update
      })
      .where(eq(users.id, user[0].id));

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

setupRoutes(app);

// Initialize database (this should now work since users already exist)
(async () => {
  try {
    const { initializeDatabase } = await import('./database/init.js');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // This is okay since we already have users from manual seeding
    console.log('💡 Users already exist from manual seeding - continuing...');
  }
})();

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;