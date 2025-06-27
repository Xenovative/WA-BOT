// API Configuration
const API_BASE_URL = window.location.origin; // Automatically uses current domain and port

// For development with separate API server (uncomment and modify as needed)
// const API_BASE_URL = 'http://localhost:3000';

// For production (uncomment and set your VPS IP when deploying)
// const API_BASE_URL = 'http://YOUR_VPS_IP:3000';

// Export the config
window.AppConfig = {
  API_BASE_URL,
  // Add other config values here if needed
  ENABLE_LOGGING: true
};
