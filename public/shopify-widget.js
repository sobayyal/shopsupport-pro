(function() {
  'use strict';

  // Configuration
  const config = window.SHOPSUPPORT_CONFIG || {
    serverUrl: window.location.origin,
    customer: null
  };

  let isWidgetOpen = false;
  let conversationId = null;
  let ws = null;

  // Create widget HTML
  function createWidget() {
    const widgetHTML = `
      <div id="shopsupport-widget" style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <!-- Chat Button -->
        <div id="chat-button" style="
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          transition: all 0.3s ease;
        " onclick="toggleChat()">
          <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>

        <!-- Chat Window -->
        <div id="chat-window" style="
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 350px;
          height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          display: none;
          flex-direction: column;
          overflow: hidden;
        ">
          <!-- Header -->
          <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Customer Support</h3>
              <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.8;">We're here to help!</p>
            </div>
            <button onclick="toggleChat()" style="
              background: none;
              border: none;
              color: white;
              cursor: pointer;
              font-size: 18px;
              opacity: 0.8;
            ">✕</button>
          </div>

          <!-- Messages -->
          <div id="chat-messages" style="
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            background: #f8f9fa;
          ">
            <div class="message agent-message" style="
              margin-bottom: 12px;
              padding: 8px 12px;
              background: #e3f2fd;
              border-radius: 12px 12px 12px 4px;
              font-size: 14px;
              line-height: 1.4;
            ">
              Hi! Welcome to our store. How can I help you today?
            </div>
          </div>

          <!-- Input -->
          <div style="
            padding: 16px;
            border-top: 1px solid #e0e0e0;
            background: white;
          ">
            <div style="display: flex; gap: 8px;">
              <input 
                id="chat-input" 
                type="text" 
                placeholder="Type your message..."
                style="
                  flex: 1;
                  padding: 12px;
                  border: 1px solid #ddd;
                  border-radius: 20px;
                  outline: none;
                  font-size: 14px;
                "
                onkeypress="handleKeyPress(event)"
              />
              <button onclick="sendMessage()" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }

  // Toggle chat window
  window.toggleChat = function() {
    const chatWindow = document.getElementById('chat-window');
    const chatButton = document.getElementById('chat-button');
    
    isWidgetOpen = !isWidgetOpen;
    
    if (isWidgetOpen) {
      chatWindow.style.display = 'flex';
      chatButton.style.transform = 'scale(0.9)';
      document.getElementById('chat-input').focus();
      
      // Connect WebSocket if not connected
      if (!ws) {
        connectWebSocket();
      }
    } else {
      chatWindow.style.display = 'none';
      chatButton.style.transform = 'scale(1)';
    }
  };

  // Handle enter key press
  window.handleKeyPress = function(event) {
    if (event.key === 'Enter') {
      sendMessage();
    }
  };

  // Send message function
  window.sendMessage = function() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;

    // Add message to chat
    addMessage(message, 'customer');
    input.value = '';

    // Send to server
    if (conversationId && ws && ws.readyState === WebSocket.OPEN) {
      // Send via WebSocket if conversation exists
      ws.send(JSON.stringify({
        type: 'customer_message',
        conversationId: conversationId,
        content: message,
        customerData: config.customer
      }));
    } else {
      // Initial message via HTTP
      fetch(`${config.serverUrl}/api/widget/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerData: config.customer,
          message: message
        })
      })
      .then(response => response.json())
      .then(data => {
        conversationId = data.conversationId;
        
        if (data.autoResponse) {
          setTimeout(() => {
            addMessage(data.autoResponse, 'agent');
          }, 1000);
        }
        
        // Connect WebSocket for real-time updates
        connectWebSocket();
      })
      .catch(error => {
        console.error('Error sending message:', error);
        addMessage('Sorry, there was an error sending your message. Please try again.', 'system');
      });
    }
  };

  // Add message to chat
  function addMessage(content, sender) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    
    let bgColor, borderRadius, align;
    
    switch (sender) {
      case 'customer':
        bgColor = '#667eea';
        borderRadius = '12px 12px 4px 12px';
        align = 'flex-end';
        messageDiv.style.color = 'white';
        break;
      case 'agent':
        bgColor = '#e3f2fd';
        borderRadius = '12px 12px 12px 4px';
        align = 'flex-start';
        break;
      case 'system':
        bgColor = '#fff3cd';
        borderRadius = '12px';
        align = 'center';
        break;
      default:
        bgColor = '#f5f5f5';
        borderRadius = '12px';
        align = 'flex-start';
    }
    
    messageDiv.className = `message ${sender}-message`;
    messageDiv.style.cssText = `
      margin-bottom: 12px;
      padding: 8px 12px;
      background: ${bgColor};
      border-radius: ${borderRadius};
      font-size: 14px;
      line-height: 1.4;
      max-width: 80%;
      align-self: ${align};
      word-wrap: break-word;
    `;
    
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Connect WebSocket for real-time updates
  function connectWebSocket() {
    if (!conversationId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${config.serverUrl.replace(/^https?:\/\//, '')}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
      console.log('Widget WebSocket connected');
    };
    
    ws.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message' && data.message.senderType === 'agent') {
          addMessage(data.message.content, 'agent');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = function() {
      console.log('Widget WebSocket disconnected');
    };
    
    ws.onerror = function(error) {
      console.error('Widget WebSocket error:', error);
    };
  }

  // Initialize widget when DOM is ready
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createWidget);
    } else {
      createWidget();
    }

    // Add hover effects
    document.addEventListener('mouseover', function(e) {
      if (e.target && e.target.id === 'chat-button') {
        e.target.style.transform = 'scale(1.05)';
      }
    });

    document.addEventListener('mouseout', function(e) {
      if (e.target && e.target.id === 'chat-button' && !isWidgetOpen) {
        e.target.style.transform = 'scale(1)';
      }
    });
  }

  // Start initialization
  init();

  // Expose widget API
  window.ShopSupportWidget = {
    open: function() {
      if (!isWidgetOpen) toggleChat();
    },
    close: function() {
      if (isWidgetOpen) toggleChat();
    },
    sendMessage: function(message) {
      if (message && typeof message === 'string') {
        const input = document.getElementById('chat-input');
        input.value = message;
        sendMessage();
      }
    }
  };

})();
