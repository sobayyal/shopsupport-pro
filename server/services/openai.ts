import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

export interface AISuggestion {
  text: string;
  confidence: number;
  category: string;
}

class OpenAIService {
  async generateResponseSuggestions(conversationContext: string): Promise<AISuggestion[]> {
    if (!process.env.OPENAI_API_KEY) {
      return [
        {
          text: "Thank you for contacting us. How can I help you today?",
          confidence: 0.8,
          category: "greeting"
        },
        {
          text: "I understand your concern. Let me look into this for you right away.",
          confidence: 0.7,
          category: "acknowledgment"
        },
        {
          text: "Could you please provide more details about the issue you're experiencing?",
          confidence: 0.6,
          category: "information_request"
        }
      ];
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a customer support AI assistant. Based on the conversation context, generate 3 helpful response suggestions for a human agent. Each suggestion should be:
            1. Professional and empathetic
            2. Actionable and specific
            3. Appropriate for the conversation context
            
            Return the suggestions as a JSON array with objects containing:
            - text: the suggested response
            - confidence: a number between 0 and 1 indicating how confident you are
            - category: one of "greeting", "acknowledgment", "information_request", "solution", "follow_up", "escalation"
            
            Conversation context:
            ${conversationContext}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const suggestions = JSON.parse(content);
      return Array.isArray(suggestions) ? suggestions : [];
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      
      // Fallback suggestions
      return [
        {
          text: "Thank you for reaching out. I'm here to help you with your inquiry.",
          confidence: 0.8,
          category: "greeting"
        },
        {
          text: "I understand this situation can be frustrating. Let me assist you in resolving this.",
          confidence: 0.7,
          category: "acknowledgment"
        },
        {
          text: "To better assist you, could you please provide additional details about your concern?",
          confidence: 0.6,
          category: "information_request"
        }
      ];
    }
  }

  async generateAutoResponse(customerMessage: string, customerData?: any): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) {
      return "Thank you for contacting us! A support agent will be with you shortly.";
    }

    try {
      // Only generate auto-response for certain types of messages
      const commonQueries = [
        'hello', 'hi', 'hey', 'help', 'support', 'order', 'shipping', 'return', 'refund'
      ];
      
      const isCommonQuery = commonQueries.some(query => 
        customerMessage.toLowerCase().includes(query)
      );

      if (!isCommonQuery) {
        return null; // Let human agent handle complex queries
      }

      const customerInfo = customerData ? 
        `Customer info: ${customerData.name || 'Unknown'} (${customerData.email || 'No email'})` : 
        'Anonymous customer';

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an auto-response system for a Shopify store's customer support. Generate a brief, helpful initial response to acknowledge the customer's message and set expectations.

            Guidelines:
            - Keep responses under 50 words
            - Be friendly and professional
            - Set expectation that a human agent will follow up if needed
            - For simple greetings, provide a welcoming response
            - For order/shipping questions, mention you're checking their order
            - For returns/refunds, acknowledge and mention policy review
            
            ${customerInfo}
            Customer message: "${customerMessage}"`
          }
        ],
        temperature: 0.5,
        max_tokens: 100
      });

      return response.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('Error generating auto-response:', error);
      return "Thank you for contacting us! A support agent will be with you shortly.";
    }
  }

  async categorizeMessage(message: string): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      return 'general';
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Categorize this customer message into one of these categories:
            - order_inquiry
            - shipping_tracking
            - return_refund
            - product_question
            - technical_issue
            - billing_payment
            - complaint
            - compliment
            - general
            
            Return only the category name.
            
            Message: "${message}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 20
      });

      return response.choices[0]?.message?.content?.trim() || 'general';
    } catch (error) {
      console.error('Error categorizing message:', error);
      return 'general';
    }
  }

  async generateSummary(conversation: any[]): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      return 'Conversation summary not available.';
    }

    try {
      const conversationText = conversation
        .map(msg => `${msg.senderType}: ${msg.content}`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Summarize this customer support conversation in 2-3 sentences. Focus on:
            1. The customer's main issue or request
            2. Key actions taken by the agent
            3. Current status or resolution
            
            Conversation:
            ${conversationText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      });

      return response.choices[0]?.message?.content || 'No summary available.';
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Error generating conversation summary.';
    }
  }
}

export const openai = new OpenAIService();
