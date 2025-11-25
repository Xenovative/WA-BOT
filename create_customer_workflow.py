import json
import os

# Define the workflow JSON structure
workflow = [
    {
        "id": "customer-llm-flow",
        "type": "tab",
        "label": "Customer LLM Messaging",
        "disabled": False,
        "info": "Send personalized LLM messages to customers with rate limiting. Features: customer list fetched from server, LLM generation, delays, pause/resume, status tracking."
    },
    {
        "id": "init-trigger",
        "type": "inject",
        "z": "customer-llm-flow",
        "name": "Start Workflow",
        "repeat": "",
        "crontab": "",
        "once": False,
        "onceDelay": 0.1,
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "inputs": 0,
        "x": 150,
        "y": 100,
        "wires": [["fetch-customers"]]
    },
    {
        "id": "fetch-customers",
        "type": "http request",
        "z": "customer-llm-flow",
        "name": "Fetch Customers",
        "method": "GET",
        "ret": "obj",
        "paytoqs": "ignore",
        "url": "http://localhost:3000/api/workflow/customers",
        "tls": "",
        "persist": False,
        "proxy": "",
        "authType": "",
        "x": 350,
        "y": 100,
        "wires": [["config-node"]]
    },
    {
        "id": "test-trigger",
        "type": "inject",
        "z": "customer-llm-flow",
        "name": "Test Message",
        "repeat": "",
        "crontab": "",
        "once": False,
        "onceDelay": 0.1,
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "inputs": 0,
        "x": 150,
        "y": 300,
        "wires": [["test-config"]]
    },
    {
        "id": "test-config",
        "type": "function",
        "z": "customer-llm-flow",
        "name": "Setup Test Customer",
        "func": """// Setup a realistic test customer for testing
// CHANGE THIS NUMBER to your own test number
msg.currentCustomer = {
    id: "85290897701@c.us", 
    name: "Test User",  // Can be English or Chinese name
    context: "Industry: 商業及專業服務"  // Matches the Excel format with industry
};

// Clear customers array so the loop stops after this message
msg.customers = null;

node.status({fill:"blue", shape:"dot", text:"Test mode: " + msg.currentCustomer.name});

return msg;""",
        "outputs": 1,
        "noerr": 0,
        "x": 350,
        "y": 300,
        "wires": [["prepare-llm-node"]]
    },
    {
        "id": "config-node",
        "type": "function",
        "z": "customer-llm-flow",
        "name": "Config: Set Customers",
        "func": """// Check if customers were fetched successfully
if (!msg.payload || !msg.payload.success || !Array.isArray(msg.payload.customers)) {
    node.error("Failed to fetch customer list");
    return null;
}

msg.customers = msg.payload.customers;

if (msg.customers.length === 0) {
    node.warn("Customer list is empty. Please upload a customer Excel file first.");
}

// Initialize index
msg.currentIndex = 0;

// Reset status
node.status({fill:"blue", shape:"dot", text:"Loaded " + msg.customers.length + " customers"});

return msg;""",
        "outputs": 1,
        "noerr": 0,
        "x": 550,
        "y": 100,
        "wires": [["iterator-node"]]
    },
    {
        "id": "iterator-node",
        "type": "function",
        "z": "customer-llm-flow",
        "name": "Get Next Customer",
        "func": """if (!msg.customers || msg.currentIndex >= msg.customers.length) {
    msg.complete = true;
    return [null, msg]; // Second output for 'done'
}

// Get current customer
const customer = msg.customers[msg.currentIndex];
msg.currentCustomer = customer;
msg.currentIndex++;

// Update status
node.status({fill:"yellow", shape:"ring", text:"Processing " + msg.currentIndex + "/" + msg.customers.length});

return [msg, null];""",
        "outputs": 2,
        "noerr": 0,
        "x": 150,
        "y": 200,
        "wires": [["rate-limit-node"], ["done-node"]]
    },
    {
        "id": "rate-limit-node",
        "type": "delay",
        "z": "customer-llm-flow",
        "name": "Rate Limit (10s)",
        "pauseType": "rate",
        "timeout": "5",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "10",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": False,
        "allowrate": False,
        "outputs": 1,
        "x": 360,
        "y": 200,
        "wires": [["prepare-llm-node"]]
    },
    {
        "id": "prepare-llm-node",
        "type": "function",
        "z": "customer-llm-flow",
        "name": "Construct Message",
        "func": """const customer = msg.currentCustomer;

// Extract industry from context (format: "Industry: XXX")
const industry = customer.context.replace('Industry: ', '').trim();

// Use the Panda SME system prompt with customer details
const systemPrompt = `🐼 熊貓企業顧問：舊客戶聯繫專用 System Prompt（純文字版）
你是「熊貓企業顧問」的智能客服機械人，負責聯絡曾經與公司有過接觸或合作的舊客戶。
你的目標是以親切、自然、專業的方式與他們重新建立聯繫（catch up），了解他們現況與業務需要，並介紹公司最新的服務與課程項目。

【公司背景】
熊貓企業顧問是一間專門協助中小企及創業者了解、申請及管理不同政府資助的企業顧問公司。
我們最新推出企業培訓課程《伴你啟航計劃》，幫助客戶學會自行申請政府資助，節省顧問費用並能更自主掌控流程。

【你的角色】
你是熊貓企業顧問的第一線關係維繫代表。
你要：
以友善態度與舊客戶開啟對話，詢問近況。
適度回顧曾經的聯繫（例如：「之前我們曾與您聯絡過某項資助計劃」）。
自然地介紹公司最新項目，如《伴你啟航計劃》。
若客戶有興趣，簡要說明內容，並邀請留下最新聯絡方式以便顧問跟進。
若客戶暫時沒有興趣，仍保持禮貌並表示後續可提供資訊更新。

【《伴你啟航計劃》簡介】
對象：中小企業主、創業者、有興趣掌握政府資助申請技巧的客戶
年費：$9,800／年（原價 $12,800／年）
平均每日開支：約 $27
優惠：首50位限定
附送：深圳補貼攻略 + 深圳補貼60分鐘一對一諮詢
優勢：
自主掌控申請進度
即時系統追蹤
零風險（不需交出所有公司資料）
充分模擬訓練，確保順利通過

【語氣與溝通風格】
使用繁體中文對話。
語氣自然、親切、有誠意，像關心老朋友。
不強迫推銷，著重關心與提供資訊。
避免過於商業化的語言，例如「限時優惠！馬上報名！」
可用輕鬆的語氣詞，如「明白呀～」、「最近情況如何？」、「要不要我幫您看看？」
目標是讓客戶感受到關懷與信任，而不是被推銷。

【對話任務範例】
開場白範例（可隨機選擇不同版本使用）：
「您好呀～好久不見！之前有聯絡過我們關於政府資助的計劃，不知道最近公司運作順利嗎？」
「嗨～近況如何？之前我們在資助申請或顧問服務方面有聯絡過，最近我們推出了一個新課程，反應很好喔！」
「您好 😊 想跟您 catch up 一下～我們最近新增了一項企業培訓課程，幫助企業自行掌握申請政府資助，很多舊客戶反應不錯～想簡單介紹一下給您參考嗎？」
進一步介紹範例：
「《伴你啟航計劃》是一個教導企業如何親自申請政府資助的課程，費用只需 $9,800／年，比傳統顧問節省至少 80% 成本，而且可以完全掌握自己的申請資料和進度～」
引導聯繫範例：
「如果您想了解詳細內容或優惠，我可以幫您安排顧問回電～方便留下您的姓名及電話嗎？」
「想了解更多可以瀏覽我們的網站：https://panda-sme.com/landingpage/」
若客戶暫時沒興趣：
「沒問題～如果之後想了解政府資助的新消息或課程更新，也可以再找我😊 我們很樂意隨時協助您！」

【重要資訊】
公司網站：https://panda-sme.com/landingpage/
在適當時候可以分享此連結給客戶了解更多詳情。

【對話目標】
主要目的：
建立關係與信任
喚醒舊客戶興趣
收集或更新客戶聯絡資料
理想成果：
客戶留下姓名與電話／電郵
或主動要求顧問聯絡
若無法立即取得資料，也確保對話留下良好印象，方便後續跟進。`;

// Create explicit instruction with customer details
const prompt = `請為以下客戶撰寫一則WhatsApp訊息：

客戶姓名：${customer.name}
客戶行業：${industry}

訊息要求：
1. 第一句必須包含客戶姓名，例如："${customer.name}您好呀～" 或 "嗨 ${customer.name}～"
2. 訊息中必須提及客戶的行業（${industry}）
3. 參考系統提示中的開場白範例風格
4. 介紹《伴你啟航計劃》的主要優勢
5. 必須包含網站連結：https://panda-sme.com/landingpage/
6. 保持親切自然，3-4句
7. 只輸出訊息內容，不要有任何其他說明

現在撰寫訊息：`;

msg.payload = {
    prompt: prompt,
    systemPrompt: systemPrompt,
    temperature: 0.7,
    maxTokens: 300
};

return msg;""",
        "outputs": 1,
        "noerr": 0,
        "x": 600,
        "y": 200,
        "wires": [["call-llm-node"]]
    },
    {
        "id": "call-llm-node",
        "type": "http request",
        "z": "customer-llm-flow",
        "name": "Generate Message (LLM)",
        "method": "POST",
        "ret": "obj",
        "paytoqs": "ignore",
        "url": "http://localhost:3000/api/workflow/generate-text",
        "tls": "",
        "persist": False,
        "proxy": "",
        "authType": "",
        "x": 820,
        "y": 200,
        "wires": [["prepare-send-node"]]
    },
    {
        "id": "prepare-send-node",
        "type": "function",
        "z": "customer-llm-flow",
        "name": "Prepare Send",
        "func": """const text = msg.payload.text;
const customer = msg.currentCustomer;

if (!text) {
    node.error("No text generated for " + customer.name);
    return null;
}

// Store original message for tracking
msg.originalMessage = text;

// Format for /api/workflow/send-message
msg.payload = {
    platform: 'whatsapp', // Default to WhatsApp
    chatId: customer.id,
    message: text
};

node.status({fill:"green", shape:"dot", text:"Sent to " + customer.name});

return msg;""",
        "outputs": 1,
        "noerr": 0,
        "x": 800,
        "y": 300,
        "wires": [["send-msg-node"]]
    },
    {
        "id": "send-msg-node",
        "type": "http request",
        "z": "customer-llm-flow",
        "name": "Send Message",
        "method": "POST",
        "ret": "obj",
        "paytoqs": "ignore",
        "url": "http://localhost:3000/api/workflow/send-message",
        "tls": "",
        "persist": False,
        "proxy": "",
        "authType": "",
        "x": 1000,
        "y": 300,
        "wires": [["track-message-node"]]
    },
    {
        "id": "track-message-node",
        "type": "function",
        "z": "customer-llm-flow",
        "name": "Track Sent Message",
        "func": """const customer = msg.currentCustomer;
const sentMessage = msg.originalMessage || '';

// Prepare tracking data
const trackingData = {
    customerId: customer.id,
    customerName: customer.name,
    message: sentMessage,
    status: msg.payload.success ? 'sent' : 'failed'
};

msg.payload = trackingData;

return msg;""",
        "outputs": 1,
        "noerr": 0,
        "x": 1200,
        "y": 300,
        "wires": [["track-api-node"]]
    },
    {
        "id": "track-api-node",
        "type": "http request",
        "z": "customer-llm-flow",
        "name": "Save to Tracking",
        "method": "POST",
        "ret": "obj",
        "paytoqs": "ignore",
        "url": "http://localhost:3000/api/workflow/track-message",
        "tls": "",
        "persist": False,
        "proxy": "",
        "authType": "",
        "x": 1400,
        "y": 300,
        "wires": [["loop-back-node"]]
    },
    {
        "id": "loop-back-node",
        "type": "link out",
        "z": "customer-llm-flow",
        "name": "Loop Back",
        "mode": "link",
        "links": ["loop-in-node"],
        "x": 1150,
        "y": 300,
        "wires": []
    },
    {
        "id": "loop-in-node",
        "type": "link in",
        "z": "customer-llm-flow",
        "name": "Loop In",
        "links": ["loop-back-node"],
        "x": 50,
        "y": 200,
        "wires": [["iterator-node"]]
    },
    {
        "id": "done-node",
        "type": "debug",
        "z": "customer-llm-flow",
        "name": "Workflow Complete",
        "active": True,
        "tosidebar": True,
        "console": False,
        "tostatus": False,
        "complete": "true",
        "targetType": "full",
        "x": 380,
        "y": 300,
        "wires": []
    },
    {
        "id": "broker",
        "type": "mqtt-broker",
        "name": "Local MQTT",
        "broker": "localhost",
        "port": "1883",
        "clientid": "",
        "autoConnect": True,
        "usetls": False
    }
]

# Ensure directory exists
output_path = r"c:\\AIapps\\WA-BOT\\workflow\\templates\\customer_llm_messaging.json"
os.makedirs(os.path.dirname(output_path), exist_ok=True)

# Write to file
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2)

print(f"Workflow generated at {output_path}")
