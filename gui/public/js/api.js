// API utility functions
class ApiClient {
    static async get(endpoint) {
        try {
            const response = await fetch(`${window.AppConfig.API_BASE_URL}${endpoint}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return await this._handleResponse(response);
        } catch (error) {
            console.error('API GET Error:', error);
            throw error;
        }
    }

    static async post(endpoint, data = {}) {
        try {
            const response = await fetch(`${window.AppConfig.API_BASE_URL}${endpoint}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await this._handleResponse(response);
        } catch (error) {
            console.error('API POST Error:', error);
            throw error;
        }
    }

    static async delete(endpoint) {
        try {
            const response = await fetch(`${window.AppConfig.API_BASE_URL}${endpoint}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            return await this._handleResponse(response);
        } catch (error) {
            console.error('API DELETE Error:', error);
            throw error;
        }
    }

    static async _handleResponse(response) {
        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            const error = new Error(data.message || 'API request failed');
            error.status = response.status;
            error.data = data;
            throw error;
        }
        
        return data;
    }
}

// Make API client globally available
window.ApiClient = ApiClient;
