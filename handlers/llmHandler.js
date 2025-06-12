const LLMFactory = require('../llm/llmFactory');

class LLMHandler {
    constructor() {
        this.llmClients = new Map();
        this.defaultProvider = process.env.LLM_PROVIDER || 'openai';
    }

    /**
     * Get or create an LLM client for a specific provider
     * @param {string} provider - LLM provider (openai, openrouter, etc.)
     * @param {Object} options - Options for the LLM client
     * @returns {Object} LLM client instance
     */
    async getLLMClient(provider = null, options = {}) {
        const providerKey = provider || this.defaultProvider;
        const cacheKey = `${providerKey}:${JSON.stringify(options)}`;

        if (!this.llmClients.has(cacheKey)) {
            const client = LLMFactory.createLLMClient(providerKey, options);
            this.llmClients.set(cacheKey, client);
        }

        return this.llmClients.get(cacheKey);
    }

    /**
     * Process an LLM node in the workflow
     * @param {Object} node - The LLM node to process
     * @param {Object} context - Current workflow context
     * @returns {Promise<Object>} - Updated context with LLM response
     */
    async processLLMNode(node, context) {
        const { type, data } = node;
        const { message, messages, prompt, variables = {} } = data;
        
        try {
            const llmClient = await this.getLLMClient(data.provider, {
                apiKey: data.apiKey,
                model: data.model,
                temperature: data.temperature,
                maxTokens: data.maxTokens
            });

            let result;
            const resolvedVars = this.resolveVariables(variables, context);

            switch (type) {
                case 'llm-chat':
                    const chatMessages = this.prepareMessages(messages, resolvedVars);
                    result = await llmClient.generateResponse('', chatMessages);
                    break;
                    
                case 'llm-prompt':
                    const resolvedPrompt = this.resolveTemplate(prompt, resolvedVars);
                    result = await llmClient.generateResponse(resolvedPrompt);
                    break;
                    
                case 'llm-extract':
                    const extractPrompt = this.resolveTemplate(prompt, resolvedVars);
                    const extraction = await llmClient.generateResponse(extractPrompt);
                    result = this.parseExtraction(extraction);
                    break;
                    
                default:
                    throw new Error(`Unknown LLM node type: ${type}`);
            }

            return {
                ...context,
                lastLLMResponse: result,
                [node.id]: result
            };
            
        } catch (error) {
            console.error(`Error processing LLM node ${node.id}:`, error);
            throw new Error(`LLM processing failed: ${error.message}`);
        }
    }

    /**
     * Resolve variables in the context
     * @private
     */
    resolveVariables(variables, context) {
        const resolved = {};
        for (const [key, value] of Object.entries(variables)) {
            if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
                const varName = value.slice(2, -1);
                resolved[key] = context[varName] || value;
            } else {
                resolved[key] = value;
            }
        }
        return resolved;
    }

    /**
     * Prepare chat messages with resolved variables
     * @private
     */
    prepareMessages(messages, variables) {
        return messages.map(msg => ({
            role: msg.role,
            content: this.resolveTemplate(msg.content, variables)
        }));
    }

    /**
     * Resolve template strings with variables
     * @private
     */
    resolveTemplate(template, variables) {
        return template.replace(/\$\{([^}]+)\}/g, (match, varName) => {
            return variables[varName] !== undefined ? variables[varName] : match;
        });
    }

    /**
     * Parse extraction results from LLM response
     * @private
     */
    parseExtraction(extraction) {
        try {
            // Try to parse as JSON first
            if (extraction.trim().startsWith('{') || extraction.trim().startsWith('[')) {
                return JSON.parse(extraction);
            }
            
            // Try to parse as key-value pairs
            const result = {};
            const lines = extraction.split('\n').filter(line => line.includes(':'));
            
            for (const line of lines) {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length > 0) {
                    result[key.trim()] = valueParts.join(':').trim();
                }
            }
            
            return Object.keys(result).length > 0 ? result : extraction;
            
        } catch (error) {
            console.error('Error parsing extraction:', error);
            return extraction;
        }
    }
}

module.exports = new LLMHandler();
