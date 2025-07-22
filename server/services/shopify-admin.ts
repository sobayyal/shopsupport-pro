// Shopify Admin API integration for Custom Apps
import { storage } from "../storage";

interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  orders_count: number;
  total_spent: string;
  default_address?: {
    city: string;
    country: string;
    province: string;
  };
}

interface ShopifyOrder {
  id: number;
  name: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string;
  created_at: string;
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: string;
  }>;
}

class ShopifyAdminService {
  private shopDomain: string;
  private accessToken: string;

  constructor() {
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '';
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (!this.shopDomain || !this.accessToken) {
      throw new Error('Shopify credentials not configured. Please set SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN environment variables.');
    }
    const url = `https://${this.shopDomain}/admin/api/2024-01/graphql.json`;
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.accessToken,
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
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

  // GraphQL query to get customer data
  async getCustomer(customerId: string): Promise<ShopifyCustomer | null> {
    const query = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          phone
          ordersCount
          totalSpent
          defaultAddress {
            city
            country
            province
          }
        }
      }
    `;

    try {
      const response = await this.makeRequest('', {
        method: 'POST',
        body: JSON.stringify({
          query,
          variables: { id: `gid://shopify/Customer/${customerId}` }
        })
      });

      const customer = response.data?.customer;
      if (!customer) return null;

      return {
        id: parseInt(customer.id.split('/').pop()),
        email: customer.email,
        first_name: customer.firstName,
        last_name: customer.lastName,
        phone: customer.phone,
        orders_count: customer.ordersCount,
        total_spent: customer.totalSpent,
        default_address: customer.defaultAddress
      };
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  }

  // Get customer by email
  async getCustomerByEmail(email: string): Promise<ShopifyCustomer | null> {
    const query = `
      query getCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
              email
              firstName
              lastName
              phone
              ordersCount
              totalSpent
              defaultAddress {
                city
                country
                province
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.makeRequest('', {
        method: 'POST',
        body: JSON.stringify({
          query,
          variables: { query: `email:${email}` }
        })
      });

      const customerEdge = response.data?.customers?.edges?.[0];
      if (!customerEdge) return null;

      const customer = customerEdge.node;
      return {
        id: parseInt(customer.id.split('/').pop()),
        email: customer.email,
        first_name: customer.firstName,
        last_name: customer.lastName,
        phone: customer.phone,
        orders_count: customer.ordersCount,
        total_spent: customer.totalSpent,
        default_address: customer.defaultAddress
      };
    } catch (error) {
      console.error('Error fetching customer by email:', error);
      return null;
    }
  }

  // Get customer's recent orders
  async getCustomerOrders(customerId: string, limit: number = 10): Promise<ShopifyOrder[]> {
    const query = `
      query getCustomerOrders($id: ID!, $first: Int!) {
        customer(id: $id) {
          orders(first: $first, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                totalPrice
                financialStatus
                fulfillmentStatus
                createdAt
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      name
                      quantity
                      originalTotalSet {
                        shopMoney {
                          amount
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.makeRequest('', {
        method: 'POST',
        body: JSON.stringify({
          query,
          variables: { 
            id: `gid://shopify/Customer/${customerId}`,
            first: limit
          }
        })
      });

      const orderEdges = response.data?.customer?.orders?.edges || [];
      
      return orderEdges.map((edge: any) => {
        const order = edge.node;
        return {
          id: parseInt(order.id.split('/').pop()),
          name: order.name,
          total_price: order.totalPrice,
          financial_status: order.financialStatus,
          fulfillment_status: order.fulfillmentStatus,
          created_at: order.createdAt,
          line_items: order.lineItems.edges.map((item: any) => ({
            id: parseInt(item.node.id.split('/').pop()),
            name: item.node.name,
            quantity: item.node.quantity,
            price: item.node.originalTotalSet.shopMoney.amount
          })) as any
        };
      });
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return [];
    }
  }

  // Sync customer data to local storage
  async syncCustomer(customerId: string): Promise<void> {
    try {
      const shopifyCustomer = await this.getCustomer(customerId);
      if (!shopifyCustomer) return;

      const location = shopifyCustomer.default_address 
        ? `${shopifyCustomer.default_address.city}, ${shopifyCustomer.default_address.province}, ${shopifyCustomer.default_address.country}`
        : null;

      // Create or update customer in local storage
      await storage.createCustomer({
        name: `${shopifyCustomer.first_name} ${shopifyCustomer.last_name}`.trim(),
        email: shopifyCustomer.email,
        phone: shopifyCustomer.phone,
        location,
        totalOrders: shopifyCustomer.orders_count,
        totalSpent: shopifyCustomer.total_spent,
        shopifyCustomerId: shopifyCustomer.id.toString()
      });

      // Sync recent orders
      const orders = await this.getCustomerOrders(customerId, 5);
      for (const order of orders) {
        await storage.createShopifyOrder({
          customerId: shopifyCustomer.id,
          shopifyOrderId: order.id.toString(),
          orderNumber: order.name,
          status: order.financial_status,
          totalPrice: order.total_price,
          items: order.line_items,
          fulfillmentStatus: order.fulfillment_status
        });
      }
    } catch (error) {
      console.error('Error syncing customer:', error);
    }
  }

  // Create a webhook for real-time updates
  async createWebhook(topic: string, address: string): Promise<boolean> {
    const mutation = `
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            callbackUrl
            topic
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const response = await this.makeRequest('', {
        method: 'POST',
        body: JSON.stringify({
          query: mutation,
          variables: {
            topic: topic.toUpperCase(),
            webhookSubscription: {
              callbackUrl: address,
              format: 'JSON'
            }
          }
        })
      });

      const result = response.data?.webhookSubscriptionCreate;
      if (result?.userErrors?.length > 0) {
        console.error('Webhook creation errors:', result.userErrors);
        return false;
      }

      return !!result?.webhookSubscription;
    } catch (error) {
      console.error('Error creating webhook:', error);
      return false;
    }
  }

  // Setup recommended webhooks
  async setupWebhooks(baseUrl: string): Promise<void> {
    const webhooks = [
      { topic: 'customers/create', endpoint: '/api/webhooks/shopify/customer-created' },
      { topic: 'customers/update', endpoint: '/api/webhooks/shopify/customer-updated' },
      { topic: 'orders/create', endpoint: '/api/webhooks/shopify/order-created' },
      { topic: 'orders/updated', endpoint: '/api/webhooks/shopify/order-updated' }
    ];

    for (const webhook of webhooks) {
      const success = await this.createWebhook(webhook.topic, `${baseUrl}${webhook.endpoint}`);
      console.log(`Webhook ${webhook.topic}: ${success ? 'created' : 'failed'}`);
    }
  }
}

export const shopifyAdminService = new ShopifyAdminService();