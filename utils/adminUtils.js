const fs = require('fs');
const path = require('path');

// Load admin configuration
let adminConfig = {
  adminUsers: new Set()
};

// Load admin users from environment variables
function loadAdminUsers() {
  try {
    // Support both ADMIN_USERS and ADMIN_PHONE_NUMBERS for backward compatibility
    const adminVar = process.env.ADMIN_USERS || process.env.ADMIN_PHONE_NUMBERS || '';
    adminConfig.adminUsers = new Set(
      adminVar
        .split(',')
        .map(u => u.trim())
        .filter(u => u)
    );
    
    // Check if authentication is required
    adminConfig.authRequired = process.env.COMMAND_AUTH_REQUIRED !== 'false';
    
    console.log(`[Admin] Loaded ${adminConfig.adminUsers.size} admin users, auth required: ${adminConfig.authRequired}`);
  } catch (error) {
    console.error('[Admin] Error loading admin users:', error);
    adminConfig.adminUsers = new Set();
  }
}

// Check if a user is an admin
function isAdmin(userId) {
  // If no auth required, everyone is an admin
  if (!adminConfig.authRequired) return true;
  
  if (!userId) return false;
  
  // Clean the user ID (remove any @c.us or similar suffixes)
  const cleanId = String(userId).split('@')[0];
  
  // Check both the clean ID and the original ID
  return adminConfig.adminUsers.has(cleanId) || 
         adminConfig.adminUsers.has(userId) ||
         adminConfig.adminUsers.has(`+${cleanId}`) ||
         adminConfig.adminUsers.has(`+${userId}`);
}

// Add an admin user (runtime only, doesn't persist)
function addAdmin(userId) {
  if (!userId) return false;
  const cleanId = String(userId).split('@')[0];
  adminConfig.adminUsers.add(cleanId);
  return true;
}

// Remove an admin user (runtime only, doesn't persist)
function removeAdmin(userId) {
  if (!userId) return false;
  const cleanId = String(userId).split('@')[0];
  return adminConfig.adminUsers.delete(cleanId);
}

// Get list of admin users
function getAdminUsers() {
  return Array.from(adminConfig.adminUsers);
}

// Initialize on require
loadAdminUsers();

// Reload admin users (useful if environment variables change)
function reloadAdminUsers() {
  loadAdminUsers();
}

// Get authentication requirement status
function isAuthRequired() {
  return adminConfig.authRequired;
}

module.exports = {
  isAdmin,
  addAdmin,
  removeAdmin,
  getAdminUsers,
  reloadAdminUsers,
  isAuthRequired
};
