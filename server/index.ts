// Simple environment loading from local .env file
import 'dotenv/config';
import bcrypt from 'bcryptjs';

import jwt from 'jsonwebtoken';


// Import other modules after environment check
import express, { Request, Response } from 'express';
import cors from 'cors';
import { setupRoutes } from './routes.js';
import { db } from './database/init.js';
import { users } from './database/schema.js';
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
// app.use(express.json());

// Test route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok22d',
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

    return user

    if (user.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user[0].passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update user online status
    await db.update(users)
      .set({ isOnline: true, lastSeen: new Date() })
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


// app.post('/auth/login', async (req, res) => {
//     try {
//       const { username, password } = req.body;

//       return req.body

//       const user = await db.select()
//         .from(users)
//         .where(eq(users.username, username))
//         .limit(1);

//       if (user.length === 0) {
//         return res.status(401).json({ message: 'Invalid credentials' });
//       }

//       const validPassword = await bcrypt.compare(password, user[0].passwordHash);
//       if (!validPassword) {
//         return res.status(401).json({ message: 'Invalid credentials' });
//       }

//       // Update user online status
//       await db.update(users)
//         .set({ isOnline: true, lastSeen: new Date().toISOString() })
//         .where(eq(users.id, user[0].id));

//       const token = jwt.sign(
//         { id: user[0].id, username: user[0].username, role: user[0].role },
//         JWT_SECRET,
//         { expiresIn: '24h' }
//       );

//       res.json({
//         token,
//         user: {
//           id: user[0].id,
//           username: user[0].username,
//           email: user[0].email,
//           role: user[0].role,
//           isOnline: true
//         }
//       });
//     } catch (error) {
//       console.error('Login error:', error);
//       res.status(500).json({ message: 'Login failed' });
//     }
//   });

(async () => {
  // Import and initialize database
  const { initializeDatabase } = await import('./database/init.js');

  try {
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
})()




// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;