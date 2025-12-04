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
        "wires": [["business-hours-node"], ["done-node"]]
    },
    {
        "id": "business-hours-node",
        "type": "function",
        "z": "customer-llm-flow",
        "name": "Check Business Hours",
        "func": """// Business hours configuration (HKT = UTC+8)
const START_HOUR = 9;   // 9:00 AM
const END_HOUR = 18;    // 6:00 PM
const TIMEZONE_OFFSET = 8; // Hong Kong UTC+8

// Get current time in HKT
const now = new Date();
const utcHour = now.getUTCHours();
const hktHour = (utcHour + TIMEZONE_OFFSET) % 24;
const hktMinutes = now.getUTCMinutes();

// Check if within business hours
const isBusinessHours = hktHour >= START_HOUR && hktHour < END_HOUR;

// Also check if it's a weekday (optional - remove if you want weekends too)
const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
const utcDay = now.getUTCDay();
// Adjust for HKT (might be different day)
const hktDay = (utcHour + TIMEZONE_OFFSET >= 24) ? (utcDay + 1) % 7 : utcDay;
const isWeekday = hktDay >= 1 && hktDay <= 5; // Monday to Friday

if (isBusinessHours && isWeekday) {
    node.status({fill:"green", shape:"dot", text:"Business hours: " + hktHour + ":" + String(hktMinutes).padStart(2, '0') + " HKT"});
    return [msg, null]; // Continue to send
} else {
    // Calculate wait time until next business hours
    let waitMinutes;
    
    if (hktHour < START_HOUR) {
        // Before business hours today
        waitMinutes = (START_HOUR - hktHour) * 60 - hktMinutes;
    } else if (hktHour >= END_HOUR) {
        // After business hours, wait until tomorrow 9am
        waitMinutes = (24 - hktHour + START_HOUR) * 60 - hktMinutes;
    } else if (!isWeekday) {
        // Weekend - calculate time until Monday 9am
        const daysUntilMonday = hktDay === 0 ? 1 : (8 - hktDay);
        waitMinutes = daysUntilMonday * 24 * 60 - hktHour * 60 - hktMinutes + START_HOUR * 60;
    }
    
    // Store wait time for the delay node
    msg.waitUntilBusinessHours = waitMinutes;
    
    const waitHours = Math.floor(waitMinutes / 60);
    const waitMins = waitMinutes % 60;
    node.status({fill:"yellow", shape:"ring", text:"Outside hours. Wait " + waitHours + "h " + waitMins + "m"});
    
    return [null, msg]; // Go to wait node
}""",
        "outputs": 2,
        "noerr": 0,
        "x": 350,
        "y": 200,
        "wires": [["rate-limit-node"], ["wait-for-business-hours"]]
    },
    {
        "id": "wait-for-business-hours",
        "type": "function",
        "z": "customer-llm-flow",
        "name": "Calculate Wait Time",
        "func": """// Set delay in milliseconds
const waitMinutes = msg.waitUntilBusinessHours || 60;
msg.delay = waitMinutes * 60 * 1000;

node.status({fill:"blue", shape:"ring", text:"Waiting " + waitMinutes + " minutes..."});

return msg;""",
        "outputs": 1,
        "noerr": 0,
        "x": 550,
        "y": 280,
        "wires": [["business-hours-delay"]]
    },
    {
        "id": "business-hours-delay",
        "type": "delay",
        "z": "customer-llm-flow",
        "name": "Wait for Business Hours",
        "pauseType": "delayv",
        "timeout": "1",
        "timeoutUnits": "hours",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": False,
        "allowrate": False,
        "outputs": 1,
        "x": 780,
        "y": 280,
        "wires": [["business-hours-node"]]
    },
    {
        "id": "rate-limit-node",
        "type": "delay",
        "z": "customer-llm-flow",
        "name": "Rate Limit (45-60s)",
        "pauseType": "random",
        "timeout": "5",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "45",
        "rateUnits": "second",
        "randomFirst": "45",
        "randomLast": "60",
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
「陳生，之前您咨詢過用政府資助幫你發展業務，我哋最新推出了BUD智能申請系統～伴您啟航計劃，只係每日一杯咖啡價錢！提前規劃2026年的生意發展，今日或明天你那個時間方便用15分鐘了解下新系統點幫到你？」
「您好呀～好久不見！之前有聯絡過我們關於政府資助的計劃，我哋最近推出咗BUD智能申請系統，幫你自己搞掂申請，每日只係一杯咖啡嘅價錢！想了解下點樣幫到你嘅業務？」
「嗨～近況如何？之前我們在資助申請方面有聯絡過，最近我們推出了伴您啟航計劃，用BUD智能系統幫企業自己申請政府資助，費用只係每日一杯咖啡！今日或明天邊個時間方便傾15分鐘？」
進一步介紹範例：
「《伴你啟航計劃》係一個BUD智能申請系統，教你點樣自己申請政府資助，費用只需 $9,800／年（每日大概一杯咖啡價錢），比傳統顧問節省至少 80% 成本！」
引導聯繫範例：
「今日或明天你那個時間方便用15分鐘了解下新系統點幫到你？直接回覆我就得！」
若客戶暫時沒興趣：
「沒問題～如果之後想了解政府資助的新消息或課程更新，也可以再找我😊 我們很樂意隨時協助您！」

【重要資訊】
不要在開場訊息中加入任何網站連結，保持訊息簡潔直接。

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
1. 第一句必須包含客戶姓名，例如："${customer.name}，之前您咨詢過..." 或 "${customer.name}您好呀～"
2. 提及客戶之前咨詢過政府資助幫助發展業務
3. 介紹「BUD智能申請系統」和《伴你啟航計劃》
4. 強調費用只係「每日一杯咖啡價錢」
5. 提及可以幫助規劃2026年的生意發展
6. 結尾詢問「今日或明天邊個時間方便用15分鐘了解下？」
7. 鼓勵直接回覆訊息
8. 使用廣東話口語風格，親切自然
9. 只輸出訊息內容，不要有任何其他說明
10. 不要加入任何網站連結

範例風格：
「${customer.name}，之前您咨詢過用政府資助幫你發展業務，我哋最新推出了BUD智能申請系統～伴您啟航計劃，只係每日一杯咖啡價錢！提前規劃2026年的生意發展，今日或明天你那個時間方便用15分鐘了解下新系統點幫到你？」

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
