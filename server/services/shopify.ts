class ShopifyService {
  private shopDomain: string;
  private accessToken: string;
  private baseUrl: string;

  constructor() {
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '';
    this.baseUrl = `https://${this.shopDomain}/admin/api/2023-10`;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (!this.shopDomain || !this.accessToken) {
      console.warn('Shopify credentials not configured');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Shopify API request failed:', error);
      return null;
    }
  }

  async getCustomer(customerId: string) {
    try {
      const response = await this.makeRequest(`/customers/${customerId}.json`);
      return response?.customer || null;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  }

  async getCustomerByEmail(email: string) {
    try {
      const response = await this.makeRequest(`/customers/search.json?query=email:${encodeURIComponent(email)}`);
      const customers = response?.customers || [];
      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      console.error('Error searching customer by email:', error);
      return null;
    }
  }

  async getCustomerOrders(customerId: string) {
    try {
      const response = await this.makeRequest(`/customers/${customerId}/orders.json`);
      return response?.orders || [];
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return [];
    }
  }

  async getOrder(orderId: string) {
    try {
      const response = await this.makeRequest(`/orders/${orderId}.json`);
      return response?.order || null;
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

  async searchOrders(query: string) {
    try {
      const response = await this.makeRequest(`/orders.json?${query}`);
      return response?.orders || [];
    } catch (error) {
      console.error('Error searching orders:', error);
      return [];
    }
  }

  async getProducts(limit: number = 50) {
    try {
      const response = await this.makeRequest(`/products.json?limit=${limit}`);
      return response?.products || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  async getProduct(productId: string) {
    try {
      const response = await this.makeRequest(`/products/${productId}.json`);
      return response?.product || null;
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  }

  // Webhook management
  async createWebhook(topic: string, address: string) {
    try {
      const webhook = {
        webhook: {
          topic,
          address,
          format: 'json'
        }
      };

      const response = await this.makeRequest('/webhooks.json', {
        method: 'POST',
        body: JSON.stringify(webhook)
      });

      return response?.webhook || null;
    } catch (error) {
      console.error('Error creating webhook:', error);
      return null;
    }
  }

  async getWebhooks() {
    try {
      const response = await this.makeRequest('/webhooks.json');
      return response?.webhooks || [];
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      return [];
    }
  }

  async deleteWebhook(webhookId: string) {
    try {
      await this.makeRequest(`/webhooks/${webhookId}.json`, {
        method: 'DELETE'
      });
      return true;
    } catch (error) {
      console.error('Error deleting webhook:', error);
      return false;
    }
  }

  // Helper methods for customer data enrichment
  async enrichCustomerData(customerEmail: string) {
    const customer = await this.getCustomerByEmail(customerEmail);
    if (!customer) return null;

    const orders = await this.getCustomerOrders(customer.id.toString());
    
    return {
      ...customer,
      orders,
      totalOrders: orders.length,
      totalSpent: customer.total_spent || '0.00',
      lastOrder: orders.length > 0 ? orders[0] : null
    };
  }

  // Setup webhooks for real-time sync
  async setupWebhooks(baseUrl: string) {
    const webhookTopics = [
      'customers/create',
      'customers/update',
      'orders/create',
      'orders/updated',
      'orders/paid'
    ];

    const results = [];
    
    for (const topic of webhookTopics) {
      const webhookUrl = `${baseUrl}/api/webhooks/shopify/${topic.replace('/', '-')}`;
      const webhook = await this.createWebhook(topic, webhookUrl);
      results.push({ topic, webhook, success: !!webhook });
    }

    return results;
  }

  // Test Shopify connection
  async testConnection() {
    try {
      const response = await this.makeRequest('/shop.json');
      return {
        connected: !!response?.shop,
        shop: response?.shop || null
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  // GraphQL queries for more efficient data fetching
  async graphqlQuery(query: string, variables: any = {}) {
    if (!this.shopDomain || !this.accessToken) {
      return null;
    }

    try {
      const response = await fetch(`https://${this.shopDomain}/admin/api/2023-10/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`GraphQL error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      console.error('GraphQL query failed:', error);
      return null;
    }
  }

  // Get customer with orders using GraphQL (more efficient)
  async getCustomerWithOrdersGraphQL(customerId: string) {
    const query = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          firstName
          lastName
          email
          phone
          createdAt
          ordersCount
          totalSpent
          orders(first: 10) {
            edges {
              node {
                id
                orderNumber
                createdAt
                totalPrice
                fulfillmentStatus
                lineItems(first: 5) {
                  edges {
                    node {
                      title
                      quantity
                      variant {
                        price
                        product {
                          title
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

    return await this.graphqlQuery(query, { id: `gid://shopify/Customer/${customerId}` });
  }
}

export const shopifyService = new ShopifyService();
