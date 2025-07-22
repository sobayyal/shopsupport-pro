(function() {
  'use strict';
  
  // Configuration - Replace with your ShopSupport Pro server URL
  const SUPPORT_SERVER_URL = window.SHOPSUPPORT_CONFIG?.serverUrl || 'YOUR_SUPPORT_SERVER_URL';
  
  // Extract Shopify customer data if available
  const getShopifyCustomerData = () => {
    // Method 1: From window.SHOPSUPPORT_CONFIG (set by liquid template)
    if (window.SHOPSUPPORT_CONFIG?.customer) {
      return window.SHOPSUPPORT_CONFIG.customer;
    }
    
    // Method 2: Try to get customer data from Shopify's liquid variables
    if (window.meta && window.meta.customer) {
      return {
        id: window.meta.customer.id,
        email: window.meta.customer.email,
        name: `${window.meta.customer.first_name} ${window.meta.customer.last_name}`.trim(),
        phone: window.meta.customer.phone
      };
    }
    
    // Method 3: Fallback for other Shopify variables
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.customer) {
      const customer = window.ShopifyAnalytics.meta.customer;
      return {
        id: customer.id,
        email: customer.email,
        name: customer.name || 'Customer'
      };
    }
    
    return null;
  };

  // Create and inject chat widget
  const createChatWidget = () => {
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'shopsupport-widget';
    widgetContainer.innerHTML = `
      <div id="chat-widget" style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <!-- Chat Window (Hidden by default) -->
        <div id="chat-window" style="
          display: none;
          width: 320px;
          height: 400px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          margin-bottom: 16px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        ">
          <!-- Header -->
          <div style="
            background: #3b82f6;
            color: white;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Chat Support</h3>
              <p style="margin: 0; font-size: 14px; opacity: 0.9;">We're here to help!</p>
            </div>
            <button id="close-chat" style="
              background: none;
              border: none;
              color: white;
              font-size: 18px;
              cursor: pointer;
              padding: 4px;
            ">&times;</button>
          </div>
          
          <!-- Messages Area -->
          <div id="messages-container" style="
            height: 280px;
            overflow-y: auto;
            padding: 16px;
            background: #f8fafc;
          ">
            <div id="messages"></div>
          </div>
          
          <!-- Input Area -->
          <div style="
            padding: 12px;
            border-top: 1px solid #e2e8f0;
            background: white;
          ">
            <div style="display: flex; gap: 8px;">
              <input 
                id="message-input" 
                type="text" 
                placeholder="Type your message..."
                style="
                  flex: 1;
                  padding: 8px 12px;
                  border: 1px solid #d1d5db;
                  border-radius: 8px;
                  outline: none;
                  font-size: 14px;
                "
              />
              <button id="send-message" style="
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 8px;
                padding: 8px 16px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
              ">Send</button>
            </div>
          </div>
        </div>
        
        <!-- Chat Toggle Button -->
        <button id="chat-toggle" style="
          width: 56px;
          height: 56px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          transition: transform 0.2s ease;
        ">
          💬
        </button>
      </div>
    `;
    
    document.body.appendChild(widgetContainer);
  };

  // Chat functionality
  let socket = null;
  let conversationId = null;
  let isConnected = false;

  const connectWebSocket = () => {
    const serverUrl = new URL(SUPPORT_SERVER_URL);
    const protocol = serverUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${serverUrl.host}/ws`;
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('ShopSupport: Connected to chat');
      isConnected = true;
      startConversation();
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    
    socket.onclose = () => {
      console.log('ShopSupport: Disconnected from chat');
      isConnected = false;
      // Try to reconnect after 3 seconds
      setTimeout(() => {
        if (!isConnected) {
          connectWebSocket();
        }
      }, 3000);
    };
    
    socket.onerror = (error) => {
      console.error('ShopSupport: WebSocket error:', error);
    };
  };

  const startConversation = async () => {
    const customerData = getShopifyCustomerData();
    
    try {
      // Fetch customer from Shopify if we have email
      let localCustomerId = 1; // Default customer ID
      
      if (customerData && customerData.email) {
        try {
          const customerResponse = await fetch(`${SUPPORT_SERVER_URL}/api/shopify/customer/${encodeURIComponent(customerData.email)}`);
          if (customerResponse.ok) {
            const shopifyCustomer = await customerResponse.json();
            localCustomerId = shopifyCustomer.id;
          }
        } catch (error) {
          console.log('ShopSupport: Could not sync customer data, using default');
        }
        
        // Also create/update in local storage
        await fetch(`${SUPPORT_SERVER_URL}/api/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            shopifyCustomerId: customerData.id?.toString()
          })
        }).catch(console.log);
      }
      
      // Create conversation
      const response = await fetch(`${SUPPORT_SERVER_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: localCustomerId,
          status: 'waiting',
          priority: 'normal'
        })
      });
      
      if (response.ok) {
        const conversation = await response.json();
        conversationId = conversation.id;
        
        // Join the conversation via WebSocket
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'join_conversation',
            conversationId: conversationId
          }));
        }
        
        // Add welcome message
        addMessage('Support Team', 'Hi! How can we help you today?', false);
      }
    } catch (error) {
      console.error('ShopSupport: Error starting conversation:', error);
      addMessage('System', 'Sorry, we are having trouble connecting. Please try again later.', false);
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'new_message':
        if (data.message.conversationId === conversationId) {
          const isOwn = data.message.senderType === 'customer';
          const senderName = data.message.senderName || (isOwn ? 'You' : 'Support');
          addMessage(senderName, data.message.content, isOwn);
        }
        break;
      case 'typing':
        // Handle typing indicator if needed
        break;
    }
  };

  const addMessage = (sender, content, isOwn = false) => {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    
    messageDiv.style.cssText = `
      margin-bottom: 12px;
      display: flex;
      ${isOwn ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
    `;
    
    messageDiv.innerHTML = `
      <div style="
        max-width: 80%;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.4;
        ${isOwn ? 
          'background: #3b82f6; color: white; border-bottom-right-radius: 4px;' : 
          'background: white; color: #374151; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px;'
        }
      ">
        ${!isOwn ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${sender}</div>` : ''}
        <div>${content}</div>
      </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
  };

  const sendMessage = (content) => {
    if (!content.trim() || !conversationId) return;
    
    // Add message to UI immediately
    addMessage('You', content, true);
    
    // Send via WebSocket
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'send_message',
        conversationId: conversationId,
        content: content.trim()
      }));
    }
  };

  // Initialize widget when DOM is ready
  const initWidget = () => {
    createChatWidget();
    
    // Event listeners
    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const closeChat = document.getElementById('close-chat');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-message');
    
    // Toggle chat window
    chatToggle.addEventListener('click', () => {
      if (chatWindow.style.display === 'none') {
        chatWindow.style.display = 'block';
        chatToggle.innerHTML = '✕';
        
        // Connect to WebSocket when opening chat
        if (!isConnected) {
          connectWebSocket();
        }
      } else {
        chatWindow.style.display = 'none';
        chatToggle.innerHTML = '💬';
      }
    });
    
    // Close chat window
    closeChat.addEventListener('click', () => {
      chatWindow.style.display = 'none';
      chatToggle.innerHTML = '💬';
    });
    
    // Send message on button click
    sendButton.addEventListener('click', () => {
      const message = messageInput.value;
      if (message.trim()) {
        sendMessage(message);
        messageInput.value = '';
      }
    });
    
    // Send message on Enter key
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const message = messageInput.value;
        if (message.trim()) {
          sendMessage(message);
          messageInput.value = '';
        }
      }
    });
    
    // Add hover effects
    chatToggle.addEventListener('mouseenter', () => {
      chatToggle.style.transform = 'scale(1.05)';
    });
    
    chatToggle.addEventListener('mouseleave', () => {
      chatToggle.style.transform = 'scale(1)';
    });
  };

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }

})();