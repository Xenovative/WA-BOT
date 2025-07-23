const ChatHandler = require('./handlers/chatHandler');
const http = require('http');

async function testChatHandler() {
  try {
    // Create a new instance of ChatHandler
    console.log('Creating ChatHandler instance...');
    const chatHandler = new ChatHandler();
    
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test getting all chats
    console.log('\n=== Testing getAllChats() ===');
    const allChats = chatHandler.getAllChats();
    console.log(`Found ${allChats.length} chats in index`);

    if (allChats.length > 0) {
      console.log('\nChats in index:', allChats.map(chat => ({
        id: chat.id,
        messageCount: chat.messageCount,
        timestamp: chat.timestamp,
        preview: chat.preview?.substring(0, 50) + (chat.preview?.length > 50 ? '...' : '')
      })));
      
      // Test getting a specific chat
      const testChatId = allChats[0].id;
      console.log(`\n=== Testing getConversation('${testChatId}') ===`);
      const messages = chatHandler.getConversation(testChatId);
      console.log(`Found ${messages.length} messages in chat ${testChatId}`);
      
      if (messages.length > 0) {
        console.log('First message:', {
          role: messages[0].role,
          content: messages[0].content?.substring(0, 50) + '...',
          timestamp: messages[0].timestamp
        });
        
        if (messages.length > 1) {
          console.log('Last message:', {
            role: messages[messages.length - 1].role,
            content: messages[messages.length - 1].content?.substring(0, 50) + '...',
            timestamp: messages[messages.length - 1].timestamp
          });
        }
      }
    } else {
      console.log('No chats found in index.');
    }
    
    // Test the API endpoint
    await testApiEndpoint();
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

async function testApiEndpoint() {
  console.log('\n=== Testing API Endpoint ===');
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chats',
      method: 'GET',
      timeout: 5000 // 5 second timeout
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('API Response Status:', res.statusCode);
          
          if (result.success === false) {
            console.error('API Error:', result.error);
            return resolve();
          }
          
          console.log('Chats from API:', {
            count: result.data ? result.data.length : 0,
            total: result.total || 0,
            hasMore: result.hasMore || false
          });
          
          if (result.data && result.data.length > 0) {
            console.log('\nSample chat from API:', {
              id: result.data[0].id,
              messageCount: result.data[0].messageCount,
              timestamp: result.data[0].timestamp,
              preview: result.data[0].preview?.substring(0, 50) + '...'
            });
          }
          
        } catch (error) {
          console.error('Error parsing API response:', error);
          console.log('Raw response:', data);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('API request failed:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.error('Is the server running on port 3000?');
      }
      resolve();
    });
    
    req.on('timeout', () => {
      console.error('API request timed out');
      req.destroy();
      resolve();
    });
    
    req.end();
  });
}

// Run the tests
console.log('Starting chat history tests...');
testChatHandler().then(() => {
  console.log('\n=== Tests completed ===');  
});
