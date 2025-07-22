# Deploy ShopSupport Pro to Vercel (Web Interface)

## Step 1: Push Your Code to GitHub

1. **Create a new GitHub repository:**
   - Go to [GitHub.com](https://github.com) and click "New repository"
   - Name it "shopsupport-pro"
   - Make it public or private
   - Click "Create repository"

2. **Upload your project files:**
   - Click "uploading an existing file"
   - Drag and drop all your project files, or zip the entire project folder
   - Write commit message: "Initial ShopSupport Pro deployment"
   - Click "Commit changes"

## Step 2: Connect to Vercel

1. **Go to Vercel:**
   - Visit [vercel.com](https://vercel.com)
   - Click "Sign up" or "Login"
   - Choose "Continue with GitHub" to connect your GitHub account

2. **Import your project:**
   - On Vercel dashboard, click "New Project"
   - Find your "shopsupport-pro" repository
   - Click "Import"

## Step 3: Configure Deployment Settings

Vercel will automatically detect your project. Configure these settings:

### Build Settings:
- **Framework Preset:** Other
- **Build Command:** `npm run build`
- **Output Directory:** `client/dist`
- **Install Command:** `npm install`

### Environment Variables:
Click "Environment Variables" and add:

```
OPENAI_API_KEY = your_openai_api_key_here
SHOPIFY_SHOP_DOMAIN = your-shop.myshopify.com  
SHOPIFY_ACCESS_TOKEN = shpat_your_access_token_here
NODE_ENV = production
```

## Step 4: Deploy

1. Click "Deploy"
2. Wait for deployment to complete (2-3 minutes)
3. You'll get a URL like: `https://shopsupport-pro.vercel.app`

## Step 5: Test Your Deployment

Visit your deployed URLs:
- **Main app:** `https://your-app.vercel.app`
- **Integration guide:** `https://your-app.vercel.app/integration`
- **Widget script:** `https://your-app.vercel.app/widget.js`

## Step 6: Add Widget to Shopify Store

1. Go to Shopify Admin → Online Store → Themes
2. Click Actions → Edit code
3. Open `layout/theme.liquid`
4. Add this code before `</body>`:

```html
<!-- ShopSupport Pro Chat Widget -->
<script>
  window.SHOPSUPPORT_CONFIG = {
    serverUrl: 'https://your-app.vercel.app', // Replace with your Vercel URL
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

5. Click "Save"

## Alternative: Deploy from Replit

If you're working in Replit:

1. **Connect Replit to GitHub:**
   - In Replit, click the version control tab
   - Click "Create a Git Repo"
   - Push to GitHub

2. **Follow steps 2-6 above**

## Troubleshooting

### Build Fails:
- Check that all files are uploaded correctly
- Verify environment variables are set
- Look at build logs in Vercel dashboard

### Widget Not Working:
- Ensure your Vercel URL is correct in Shopify theme
- Check browser console for errors
- Verify API endpoints are responding

### API Errors:
- Double-check environment variables in Vercel dashboard
- Test Shopify API credentials
- Review function logs in Vercel

## Automatic Deployments

Once connected:
- Every push to GitHub automatically deploys
- Vercel provides preview deployments for branches
- Production deployments happen on main branch

## Custom Domain (Optional)

In Vercel dashboard:
1. Go to your project settings
2. Click "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Update Shopify theme with new domain

Your ShopSupport Pro platform will be live and ready to handle customer support!