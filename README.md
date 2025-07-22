# ShopSupport Pro - Complete Customer Support Platform

A comprehensive customer support platform built specifically for Shopify stores, featuring live chat, AI-powered responses, and seamless Shopify integration.

## 🚀 Features

### Core Features
- **Live Chat Widget** - Embeddable chat widget for Shopify stores
- **AI-Powered Responses** - OpenAI GPT-4o integration for smart suggestions
- **Shopify Integration** - Complete customer data and order history sync
- **Real-time Messaging** - WebSocket-powered live chat
- **Role-Based Access** - Agent, Manager, and Admin roles
- **Mobile Responsive** - Works on all devices

### Advanced Features
- **Automatic Customer Recognition** - Detects logged-in Shopify customers
- **Order History Integration** - Full customer purchase context
- **AI Response Suggestions** - Context-aware support recommendations
- **Conversation Assignment** - Route chats to specific agents
- **Dashboard Analytics** - Real-time support metrics
- **Webhook Integration** - Automatic customer data sync

## 🛠 Tech Stack

### Frontend
- **React** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **TanStack Query** for state management
- **Wouter** for routing

### Backend
- **Node.js** with Express
- **WebSocket** for real-time communication
- **TypeScript** for type safety
- **Drizzle ORM** for database operations

### Integrations
- **OpenAI API** - AI response generation
- **Shopify Admin API** - Customer and order data
- **GraphQL** - Efficient data fetching

## 📦 Quick Deploy to Vercel

### Option 1: GitHub + Vercel (Recommended)

1. **Upload to GitHub:**
   - Create new repository on GitHub
   - Upload all project files
   - Commit changes

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project" → Import from GitHub
   - Select your repository
   - Add environment variables (see below)
   - Deploy

### Option 2: Direct Upload to Vercel
- Zip your project folder
- Drag and drop on Vercel dashboard
- Configure settings and deploy

## ⚙️ Environment Variables

Add these in Vercel dashboard or your deployment platform:

```bash
OPENAI_API_KEY=sk-your_openai_api_key
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_shopify_token
NODE_ENV=production
```

## 🛍️ Shopify Integration Setup

### 1. Create Shopify Custom App
- Go to Shopify Admin → Settings → Apps and sales channels
- Click "Develop apps for your store"
- Create app with `read_customers` and `read_orders` scopes

### 2. Add Widget to Your Store
Add this code to `layout/theme.liquid` before `</body>`:

```html
<!-- ShopSupport Pro Chat Widget -->
<script>
  window.SHOPSUPPORT_CONFIG = {
    serverUrl: 'https://your-app.vercel.app',
    {% if customer %}
    customer: {
      id: {{ customer.id | json }},
      email: {{ customer.email | json }},
      name: {{ customer.first_name | append: ' ' | append: customer.last_name | json }},
      phone: {{ customer.phone | json }}
    }
    {% endif %}
  };
</script>
<script src="https://your-app.vercel.app/widget.js" async></script>
```

## 📖 Documentation

- **[Vercel Web Deployment Guide](VERCEL_WEB_DEPLOYMENT.md)** - Step-by-step web deployment
- **[Vercel CLI Deployment Guide](VERCEL_DEPLOYMENT_GUIDE.md)** - Command-line deployment
- **[Shopify Setup Guide](SHOPIFY_SETUP_GUIDE.md)** - Complete Shopify integration

## 🔧 Development

### Local Setup
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

## 📋 Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # App pages
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities
├── server/                 # Express backend
│   ├── services/           # External integrations
│   ├── routes.ts           # API endpoints
│   └── storage.ts          # Data layer
├── shared/                 # Shared types/schemas
├── public/                 # Static assets
└── api/                    # Vercel serverless functions
```

## 🎯 Key URLs After Deployment

- **Dashboard:** `https://your-app.vercel.app`
- **Integration Guide:** `https://your-app.vercel.app/integration`
- **Widget Script:** `https://your-app.vercel.app/widget.js`
- **Setup Instructions:** `https://your-app.vercel.app/setup`

## 🛡️ Security Features

- **Environment Variable Protection** - Sensitive keys secured
- **CORS Configuration** - Proper cross-origin handling  
- **Input Validation** - All API inputs validated
- **Authentication** - Role-based access control

## 📱 Mobile Support

- Fully responsive design
- Touch-optimized chat interface
- Mobile-friendly widget
- Progressive web app features

## 🤝 Support

For deployment issues or customization:
1. Check deployment logs in your platform dashboard
2. Verify environment variables are set correctly
3. Test API endpoints individually
4. Review browser console for client-side errors

## 📄 License

MIT License - Free for commercial use

---

**Ready to deploy?** Follow the [Vercel Web Deployment Guide](VERCEL_WEB_DEPLOYMENT.md) to get started!