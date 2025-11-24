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
        "props": [
            {"p": "payload"},
            {"p": "topic", "vt": "str"}
        ],
        "repeat": "",
        "crontab": "",
        "once": False,
        "onceDelay": 0.1,
        "topic": "",
        "payload": "",
        "payloadType": "date",
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
        "props": [
            {"p": "payload"},
            {"p": "topic", "vt": "str"}
        ],
        "repeat": "",
        "crontab": "",
        "once": False,
        "onceDelay": 0.1,
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "x": 150,
        "y": 300,
        "wires": [["test-config"]]
    },
    {
        "id": "test-config",
        "type": "function",
        "z": "customer-llm-flow",
        "name": "Setup Test Customer",
        "func": """// Setup a dummy customer for testing
// CHANGE THIS NUMBER to your own test number
msg.currentCustomer = {
    id: "85290897701@c.us", 
    name: "Test User",
    context: "Testing the system functionality"
};

// Clear customers array so the loop stops after this message
msg.customers = null;

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
        "name": "Prepare LLM Request",
        "func": """const customer = msg.currentCustomer;

// Construct the prompt for the LLM
// We ask the LLM to generate the message body.
const prompt = `Write a message for ${customer.name}. Context: ${customer.context}`;

msg.payload = {
    prompt: prompt
    // systemPrompt and temperature are omitted to use system defaults from WA-BOT configuration
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
        "name": "Generate Text (LLM)",
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
