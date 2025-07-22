# ShopSupport Pro - Shopify Integration Guide

This guide will help you integrate ShopSupport Pro with your Shopify store using Custom App APIs.

## Step 1: Create a Shopify Custom App

1. Go to your Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps for your store"
3. Click "Create an app"
4. Name your app "ShopSupport Pro"
5. Configure the app with the following scopes:

### Required API Access Scopes:
- `read_customers` - To fetch customer information
- `read_orders` - To fetch order history
- `write_customers` - To update customer data (optional)

### Admin API Access:
- Check "Admin API integration"
- Add these GraphQL Admin API access scopes:
  - `read_customers`
  - `read_orders`
  - `read_customer_events`

## Step 2: Get Your API Credentials

After creating the app:

1. Go to API credentials
2. Copy your "Admin API access token" 
3. Your shop domain (e.g., `your-shop.myshopify.com`)

## Step 3: Configure ShopSupport Pro Server

Add these environment variables to your ShopSupport Pro deployment:

```bash
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token_here
```

## Step 4: Add Chat Widget to Your Shopify Theme

### Method A: Direct Script Integration

1. In your Shopify Admin, go to Online Store → Themes
2. Click "Actions" → "Edit code" on your active theme
3. Open `layout/theme.liquid`
4. Add this code before the closing `</body>` tag:

```html
<!-- ShopSupport Pro Chat Widget -->
<script>
  // Configuration
  window.SHOPSUPPORT_CONFIG = {
    serverUrl: 'YOUR_SHOPSUPPORT_SERVER_URL', // Replace with your server URL
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
<script src="YOUR_SHOPSUPPORT_SERVER_URL/widget.js" async></script>
```

### Method B: App Block Integration (Recommended)

1. Create a new section file `sections/shopsupport-chat.liquid`:

```liquid
<!-- ShopSupport Pro Chat Widget Section -->
<script>
  window.SHOPSUPPORT_CONFIG = {
    serverUrl: '{{ section.settings.server_url }}',
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
<script src="{{ section.settings.server_url }}/widget.js" async></script>

{% schema %}
{
  "name": "ShopSupport Chat",
  "target": "body",
  "settings": [
    {
      "type": "url",
      "id": "server_url",
      "label": "ShopSupport Server URL",
      "default": "https://your-support-server.com"
    }
  ]
}
{% endschema %}
```

2. Add the section to your theme by editing `layout/theme.liquid` and adding:
```liquid
{% section 'shopsupport-chat' %}
```

## Step 5: Setup Webhooks (Automatic Real-time Updates)

After deploying your ShopSupport Pro server, make a POST request to setup webhooks:

```bash
curl -X POST https://your-support-server.com/api/admin/setup-webhooks
```

This will automatically create webhooks for:
- Customer creation/updates
- Order creation/updates

## Step 6: Test the Integration

1. Visit your Shopify store
2. You should see the chat widget in the bottom-right corner
3. Click on it to start a conversation
4. If logged in, your customer data should be automatically loaded

## Customization Options

### Widget Styling
You can customize the widget appearance by adding CSS to your theme:

```css
/* Custom styles for ShopSupport widget */
#shopsupport-widget {
  /* Your custom styles here */
}

#chat-toggle {
  background-color: #your-brand-color !important;
}
```

### Widget Position
To change the widget position, add CSS:

```css
#chat-widget {
  bottom: 20px !important;
  left: 20px !important; /* Move to left side */
  right: auto !important;
}
```

## Security Notes

- Keep your Shopify access token secure
- The widget automatically detects customer login status
- All communications are encrypted via HTTPS/WSS
- Customer data is synced securely using Shopify's official APIs

## Troubleshooting

### Widget Not Showing
1. Check browser console for errors
2. Verify the server URL is correct
3. Ensure CORS is properly configured on your server

### Customer Data Not Loading
1. Verify Shopify API credentials
2. Check that the customer is logged in
3. Review server logs for API errors

### Real-time Updates Not Working
1. Check WebSocket connection in browser dev tools
2. Verify webhooks are created in Shopify Admin
3. Test webhook endpoints manually

## Support

For technical support or customization requests, contact your ShopSupport Pro administrator.