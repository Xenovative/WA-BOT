# WhatsApp Bot Workflow System

This document explains how to use the workflow automation system integrated with your WhatsApp bot.

## Overview

The workflow system allows you to create automated responses and actions based on various triggers:

1. **Time-based triggers** - Schedule messages or actions at specific times
2. **Keyword triggers** - Detect specific keywords in messages to trigger actions
3. **File event triggers** - React when files are uploaded or modified

The system is built on Node-RED, a powerful flow-based programming tool that makes it easy to create automations with a visual editor.

## Getting Started

### Accessing the Workflow Editor

1. Start your WhatsApp bot application
2. Open a web browser and navigate to: `http://localhost:1880`

## Using Standard Node-RED Nodes

Instead of custom nodes, this system uses standard Node-RED nodes with API endpoints to interact with the WhatsApp bot. Here's how to use them:

### Trigger Nodes

1. **Keyword Triggers**: Use the standard Node-RED "Switch" node to check message content
   - Connect it to an "MQTT In" node subscribed to the "whatsapp/messages" topic
   - Configure the Switch node to match your keywords

2. **Time-based Triggers**: Use the standard Node-RED "Inject" node
   - Configure it with your desired schedule

3. **File Triggers**: Use the standard Node-RED "Watch" node
   - Point it to the directory you want to monitor

### Action Nodes

1. **Send WhatsApp Message**: Use an "HTTP Request" node with these settings:
   - Method: POST
   - URL: http://localhost:3000/api/workflow/send-message
   - Body: `{"recipient":"PHONE_NUMBER", "message":"YOUR_MESSAGE", "messageType":"text"}`

2. **Run Command**: Use an "HTTP Request" node with these settings:
   - Method: POST
   - URL: http://localhost:3000/api/workflow/run-command
   - Body: `{"command":"YOUR_COMMAND"}`

3. **Process File**: Use an "HTTP Request" node with these settings:
   - Method: POST
   - URL: http://localhost:3000/api/workflow/process-file
   - Body: `{"filename":"PATH_TO_FILE", "action":"add_to_kb"}`
3. Log in with the credentials set in your `.env` file:
   - Username: `WORKFLOW_ADMIN_USER` (default: admin)
   - Password: `WORKFLOW_ADMIN_PASSWORD` (default: password)

### Loading Sample Workflows

1. In the Node-RED editor, click on the menu (☰) in the top-right corner
2. Select "Import" > "Clipboard"
3. Click "select a file to import" and choose the `flows_sample.json` file from the `.node-red` directory
4. Click "Import" to load the sample workflows

## Creating Workflows

### Triggers

The system provides three types of triggers:

#### 1. Keyword Trigger

Detects specific keywords in incoming messages.

- **Node**: `wa-bot-keyword-trigger`
- **Configuration**:
  - **Keywords**: List of words or phrases to detect
  - **Match Type**: How to match keywords (contains, exact, regex)
  - **Case Sensitive**: Whether to match case-sensitively

#### 2. Time Trigger

Schedules actions at specific times.

- **Node**: Standard Node-RED `inject` node
- **Configuration**:
  - **Repeat**: Set to "interval" or "at a specific time"
  - **Cron**: For advanced scheduling (e.g., "00 09 * * *" for 9:00 AM daily)

#### 3. File Trigger

Reacts to file events (upload, delete).

- **Node**: `wa-bot-file-trigger`
- **Configuration**:
  - **Event Type**: Type of file event (upload, delete, all)
  - **File Pattern**: Pattern to match filenames (e.g., "*.pdf")

### Actions

The system provides several actions you can perform:

#### 1. Send Message

Sends a WhatsApp message to a contact.

- **Node**: `wa-bot-send-message`
- **Configuration**:
  - **Message**: Text to send (can be set dynamically)
  - **Chat ID**: Recipient's chat ID (can be passed from a trigger)

#### 2. Run Command

Executes a bot command as if it was sent by a user.

- **Node**: `wa-bot-run-command`
- **Configuration**:
  - **Command**: Command to run (e.g., "!help", "!clear")
  - **Chat ID**: Context for the command

#### 3. Process File

Processes a file for the knowledge base.

- **Node**: `wa-bot-process-file`
- **Configuration**:
  - **Action**: What to do with the file (add_to_kb, delete_from_kb)
  - **Filename**: Name of the file to process

### Processing Nodes

You can also use standard Node-RED nodes for processing:

- **Function**: Write JavaScript code to process data
- **Switch**: Route messages based on conditions
- **Change**: Modify message properties
- **Template**: Create formatted text using Mustache templates

## Example Workflows

### 1. Keyword Response

Responds to greetings with a time-appropriate message.

- **Trigger**: Keywords "hello", "hi", "hey"
- **Action**: Sends a greeting based on time of day

### 2. Scheduled Message

Sends a daily reminder to active chats.

- **Trigger**: Time-based (9:00 AM daily)
- **Action**: Sends a reminder message to all active chats

### 3. File Processing

Automatically processes uploaded PDF files.

- **Trigger**: PDF file upload
- **Action**: Adds file to knowledge base and sends confirmation

## Advanced Usage

### Accessing Bot Components

In function nodes, you can access bot components through the global context:

```javascript
// Get chat handler
const chatHandler = global.get('chatHandler');

// Get command handler
const commandHandler = global.get('commandHandler');

// Get WhatsApp client
const client = global.get('whatsappClient');

// Get knowledge base manager
const kbManager = global.get('kbManager');
```

### Creating Complex Workflows

You can combine multiple triggers and actions to create complex workflows:

1. **Multi-step conversations**: Use the context to store conversation state
2. **Conditional responses**: Use switch nodes to handle different scenarios
3. **Data processing**: Transform data between triggers and actions

## Troubleshooting

### Common Issues

1. **Workflow not triggering**:
   - Check that the workflow is deployed and enabled
   - Verify that the trigger conditions are correct

2. **Actions not executing**:
   - Check the node status (hover over the node)
   - Look for errors in the debug panel

3. **Node-RED not accessible**:
   - Verify that the bot is running
   - Check the port configuration in your `.env` file

### Logs

Check the console output for workflow-related logs:

- `[WorkflowManager]` - General workflow system logs
- `[Node-RED]` - Node-RED runtime logs

## Security Considerations

- The workflow editor is password-protected
- Workflows run with the same permissions as the bot
- Be careful with workflows that send messages to prevent spam

## Customizing the Workflow System

To add new trigger or action types:

1. Create a new node definition in `workflow/nodes/`
2. Register it in `workflow/nodes/index.js`
3. Restart the bot to load the new node

## Need Help?

For more information on Node-RED, visit the [official documentation](https://nodered.org/docs/).
