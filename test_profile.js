const commandHandler = require('./handlers/commandHandler');

console.log('=== Profile System Test ===');
console.log('Current Profile:', commandHandler.currentProfileName);
console.log('System Prompt:', commandHandler.systemPrompt.substring(0, 100) + '...');
console.log('Provider:', commandHandler.currentProvider);
console.log('Model:', commandHandler.currentModel);
console.log('Available Profiles:', Object.keys(commandHandler.configProfiles));

const settings = commandHandler.getCurrentSettings();
console.log('\n=== getCurrentSettings() ===');
console.log('System Prompt from getCurrentSettings():', settings.systemPrompt.substring(0, 100) + '...');
