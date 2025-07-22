import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "your_openai_api_key_here" 
});

export interface AISuggestion {
  text: string;
  confidence: number;
  category: string;
}

export async function generateResponseSuggestion(
  customerMessage: string,
  conversationContext: string[] = [],
  customerData?: any
): Promise<AISuggestion[]> {
  try {
    const contextText = conversationContext.length > 0 
      ? `Previous conversation:\n${conversationContext.join('\n')}\n\n` 
      : '';
    
    const customerInfo = customerData 
      ? `Customer info: ${JSON.stringify(customerData, null, 2)}\n\n`
      : '';

    const prompt = `You are a helpful customer support AI assistant. Based on the customer's message and context, suggest 3 appropriate response options.

${customerInfo}${contextText}Customer message: "${customerMessage}"

Provide 3 response suggestions that are:
1. Professional and helpful
2. Specific to the customer's inquiry
3. Appropriate for a customer support context

Respond with JSON in this format:
{
  "suggestions": [
    {
      "text": "response text",
      "confidence": 0.9,
      "category": "information|support|resolution"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert customer support AI that generates helpful response suggestions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800
    });

    const result = JSON.parse(response.choices[0].message.content || '{"suggestions": []}');
    return result.suggestions || [];
  } catch (error) {
    console.error("Error generating AI suggestions:", error);
    return [];
  }
}

export async function categorizeMessage(message: string): Promise<{
  category: string;
  priority: string;
  sentiment: string;
}> {
  try {
    const prompt = `Analyze this customer support message and categorize it:

Message: "${message}"

Provide analysis in JSON format:
{
  "category": "order_inquiry|product_question|complaint|compliment|technical_support|return_request|other",
  "priority": "low|normal|high|urgent",
  "sentiment": "positive|neutral|negative"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing customer support messages for categorization and routing."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      category: result.category || 'other',
      priority: result.priority || 'normal',
      sentiment: result.sentiment || 'neutral'
    };
  } catch (error) {
    console.error("Error categorizing message:", error);
    return {
      category: 'other',
      priority: 'normal',
      sentiment: 'neutral'
    };
  }
}

export async function generateAutoResponse(
  customerMessage: string,
  customerData?: any
): Promise<string | null> {
  try {
    const customerInfo = customerData 
      ? `Customer info: Name: ${customerData.name}, Email: ${customerData.email}\n`
      : '';

    const prompt = `You are an AI customer support assistant. The customer has sent this message:

${customerInfo}Customer message: "${customerMessage}"

If this is a simple query that can be handled automatically (like basic information requests, order status inquiries with order details provided, etc.), provide a helpful response.

If this requires human intervention, respond with "HUMAN_REQUIRED".

Keep responses friendly, professional, and concise.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a customer support AI that can handle simple queries automatically or escalate to humans when needed."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300
    });

    const content = response.choices[0].message.content?.trim();
    return content === "HUMAN_REQUIRED" ? null : content || null;
  } catch (error) {
    console.error("Error generating auto response:", error);
    return null;
  }
}
