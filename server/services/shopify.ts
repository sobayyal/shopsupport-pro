interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
}

interface ShopifyCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  orders_count: number;
  total_spent: string;
  addresses: any[];
  default_address: any;
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: any[];
  customer: ShopifyCustomer;
}

export class ShopifyService {
  private config: ShopifyConfig;

  constructor() {
    this.config = {
      shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || process.env.SHOP_DOMAIN || '',
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_TOKEN || ''
    };
  }

  private async makeRequest(endpoint: string): Promise<any> {
    if (!this.config.shopDomain || !this.config.accessToken) {
      throw new Error('Shopify configuration not found. Please set SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN environment variables.');
    }

    const url = `https://${this.config.shopDomain}.myshopify.com/admin/api/2023-10/${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': this.config.accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Shopify API request failed:', error);
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<ShopifyCustomer | null> {
    try {
      const data = await this.makeRequest(`customers/${customerId}.json`);
      return data.customer || null;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  }

  async getCustomerByEmail(email: string): Promise<ShopifyCustomer | null> {
    try {
      const data = await this.makeRequest(`customers/search.json?query=email:${encodeURIComponent(email)}`);
      return data.customers && data.customers.length > 0 ? data.customers[0] : null;
    } catch (error) {
      console.error('Error searching customer by email:', error);
      return null;
    }
  }

  async getCustomerOrders(customerId: string): Promise<ShopifyOrder[]> {
    try {
      const data = await this.makeRequest(`customers/${customerId}/orders.json`);
      return data.orders || [];
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return [];
    }
  }

  async getOrder(orderId: string): Promise<ShopifyOrder | null> {
    try {
      const data = await this.makeRequest(`orders/${orderId}.json`);
      return data.order || null;
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

  async getOrderByNumber(orderNumber: string): Promise<ShopifyOrder | null> {
    try {
      const data = await this.makeRequest(`orders.json?name=${encodeURIComponent(orderNumber)}`);
      return data.orders && data.orders.length > 0 ? data.orders[0] : null;
    } catch (error) {
      console.error('Error fetching order by number:', error);
      return null;
    }
  }

  async createCustomer(customerData: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  }): Promise<ShopifyCustomer | null> {
    try {
      const response = await fetch(`https://${this.config.shopDomain}.myshopify.com/admin/api/2023-10/customers.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.config.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customer: customerData }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create customer: ${response.status}`);
      }

      const data = await response.json();
      return data.customer || null;
    } catch (error) {
      console.error('Error creating customer:', error);
      return null;
    }
  }

  // Webhook verification
  verifyWebhook(data: string, signature: string): boolean {
    const crypto = require('crypto');
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
    
    if (!webhookSecret) {
      console.warn('Shopify webhook secret not configured');
      return false;
    }

    const calculatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(data, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(calculatedSignature, 'utf8')
    );
  }
}

export const shopifyService = new ShopifyService();
