# Vercel Deployment Guide for ShopSupport Pro

This guide will help you deploy your complete ShopSupport Pro platform to Vercel.

## Important Note About WebSockets on Vercel

⚠️ **WebSocket Limitation**: Vercel's serverless functions don't support persistent WebSocket connections. The real-time chat features will work differently on Vercel:

### What Works on Vercel:
- ✅ Complete chat interface
- ✅ Message sending and receiving 
- ✅ Shopify integration and customer data
- ✅ AI response suggestions
- ✅ All dashboard features
- ✅ Customer support workflows

### What's Modified on Vercel:
- 🔄 **Real-time updates**: Uses HTTP polling instead of WebSockets
- 🔄 **Chat widget**: Still fully functional but refreshes messages periodically

## Option 1: Deploy to Vercel (Recommended for Testing)

### Step 1: Prepare for Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

### Step 2: Deploy Your Project

1. From your project root, run:
```bash
vercel
```

2. Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? Choose your account
   - Link to existing project? **N** 
   - Project name: **shopsupport-pro**
   - Directory: **./** (current directory)
   - Override settings? **N**

### Step 3: Configure Environment Variables

Add your environment variables in Vercel dashboard:

1. Go to your project in Vercel dashboard
2. Navigate to Settings → Environment Variables
3. Add these variables:

```
OPENAI_API_KEY=your_openai_api_key_here
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token_here
```

### Step 4: Redeploy

After adding environment variables, redeploy:
```bash
vercel --prod
```

## Option 2: Deploy to Railway/Render (Recommended for Production)

For full WebSocket support and real-time features, consider these platforms:

### Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway new
railway add
railway deploy
```

### Render Deployment
1. Connect your GitHub repo to Render
2. Choose "Web Service"
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Add environment variables

## Option 3: Self-Hosted VPS

For maximum control and all features:

### DigitalOcean/AWS/Google Cloud
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start with PM2
npm install -g pm2
pm2 start dist/index.js --name "shopsupport-pro"
```

## Vercel-Specific Configuration

The project includes a `vercel.json` file that:
- Routes API requests to the server function
- Serves the widget script at `/widget.js`
- Handles the integration guides at `/setup` and `/integration`
- Serves the frontend from the built static files

## Environment Variables Required

For any deployment platform, you need:

```bash
NODE_ENV=production
OPENAI_API_KEY=sk-...
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com  
SHOPIFY_ACCESS_TOKEN=shpat_...
```

## Testing Your Deployment

1. Visit your deployed URL
2. Check the dashboard works: `https://your-app.vercel.app`
3. Test the integration guide: `https://your-app.vercel.app/integration`
4. Download the widget: `https://your-app.vercel.app/widget.js`

## Adding Widget to Shopify

Once deployed, update your Shopify theme with your Vercel URL:

```html
<script>
  window.SHOPSUPPORT_CONFIG = {
    serverUrl: 'https://your-app.vercel.app', // Your Vercel URL
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

## Troubleshooting

### Build Errors
- Ensure all TypeScript types are correct
- Check that environment variables are set

### API Errors
- Verify Shopify credentials in Vercel dashboard
- Check OpenAI API key is valid

### Widget Not Loading
- Confirm the widget URL is accessible
- Check browser console for CORS errors

## Performance Considerations

### Vercel Limits
- Function execution time: 30 seconds
- Function memory: 1024MB
- Monthly execution time: Based on plan

### Optimization
- Static assets are served via Vercel's CDN
- API routes are optimized for serverless
- Database queries are optimized for quick responses

## Support

For deployment issues:
1. Check Vercel function logs in dashboard
2. Test API endpoints directly
3. Verify environment variables are set correctly

Your ShopSupport Pro platform is ready for deployment!