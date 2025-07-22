// Vercel serverless function entry point
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { storage } from '../server/storage.js';
import { insertUserSchema, insertCustomerSchema, insertConversationSchema, insertMessageSchema } from '../shared/schema.js';
import { generateResponseSuggestion, categorizeMessage, generateAutoResponse } from '../server/services/openai.js';
import { shopifyService } from '../server/services/shopify.js';
import { shopifyAdminService } from '../server/services/shopify-admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve widget script
app.get('/widget.js', (req, res) => {
  const widgetPath = path.join(__dirname, '../public/shopify-widget.js');
  if (fs.existsSync(widgetPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(widgetPath);
  } else {
    res.status(404).send('Widget not found');
  }
});

// Integration guide routes
app.get('/integration', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ShopSupport Pro - Integration Guide</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .code { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        h1 { color: #333; }
        h2 { color: #666; }
      </style>
    </head>
    <body>
      <h1>ShopSupport Pro Integration Guide</h1>
      <h2>Add Widget to Your Shopify Store</h2>
      <p>Add this code to your theme.liquid file before the closing &lt;/body&gt; tag:</p>
      <div class="code">
        &lt;script&gt;<br>
        &nbsp;&nbsp;window.SHOPSUPPORT_CONFIG = {<br>
        &nbsp;&nbsp;&nbsp;&nbsp;serverUrl: '${req.protocol}://${req.get('host')}',<br>
        &nbsp;&nbsp;&nbsp;&nbsp;{% if customer %}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;customer: {<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;id: {{ customer.id | json }},<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;email: {{ customer.email | json }},<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;name: {{ customer.first_name | append: ' ' | append: customer.last_name | json }},<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;phone: {{ customer.phone | json }}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;{% endif %}<br>
        &nbsp;&nbsp;};<br>
        &lt;/script&gt;<br>
        &lt;script src="${req.protocol}://${req.get('host')}/widget.js" async&gt;&lt;/script&gt;
      </div>
      <h2>Dashboard Access</h2>
      <p>Access your support dashboard at: <a href="${req.protocol}://${req.get('host')}">${req.protocol}://${req.get('host')}</a></p>
    </body>
    </html>
  `);
});

app.get('/setup', (req, res) => {
  res.redirect('/integration');
});

// API Routes
app.get('/api/users', async (req, res) => {
  // Return mock users for now
  const users = [
    { id: 1, username: 'admin', role: 'admin', isOnline: true },
    { id: 2, username: 'agent1', role: 'agent', isOnline: false }
  ];
  res.json(users);
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Basic authentication - in production, use proper password hashing
  const validUsers = [
    { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
    { id: 2, username: 'agent', password: 'agent123', role: 'agent' }
  ];
  
  const user = validUsers.find(u => u.username === username && u.password === password);
  
  if (user) {
    res.json({ user: { id: user.id, username: user.username, role: user.role } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/conversations', async (req, res) => {
  const conversations = await storage.getConversations();
  res.json(conversations);
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  const conversationId = parseInt(req.params.id);
  const messages = await storage.getMessagesByConversation(conversationId);
  res.json(messages);
});

app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const messageData = insertMessageSchema.parse(req.body);
    
    const message = await storage.createMessage({
      ...messageData,
      conversationId,
      timestamp: new Date()
    });

    res.json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

app.get('/api/customers/:id/shopify', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const customer = await storage.getCustomer(customerId);
    
    if (!customer || !customer.shopifyId) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const shopifyData = await shopifyAdminService.getCustomerByEmail(customer.email);
    res.json(shopifyData);
  } catch (error) {
    console.error('Error fetching Shopify data:', error);
    res.status(500).json({ error: 'Failed to fetch customer data' });
  }
});

app.get('/api/dashboard/stats', async (req, res) => {
  // Calculate basic stats from conversations
  const conversations = await storage.getConversations();
  const activeChats = conversations.filter(c => c.status === 'active').length;
  const waitingChats = conversations.filter(c => c.status === 'waiting').length;
  const resolvedChats = conversations.filter(c => c.status === 'resolved').length;
  
  const stats = {
    activeChats,
    waitingChats,
    resolvedChats,
    totalChats: conversations.length,
    avgResponseTime: '2m 30s'
  };
  
  res.json(stats);
});

app.patch('/api/conversations/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    
    const conversation = await storage.updateConversation(id, updates);
    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Serve static assets
app.get('/assets/*', (req, res) => {
  const assetPath = path.join(__dirname, '../dist/public', req.path);
  if (fs.existsSync(assetPath)) {
    res.sendFile(assetPath);
  } else {
    res.status(404).send('Asset not found');
  }
});

// Default route - serve React app
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../dist/public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application not built. Please run npm run build first.');
  }
});

export default app;
