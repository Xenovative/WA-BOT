const fs = require('fs');
const path = require('path');

// Load admin configuration
let adminConfig = {
  adminUsers: new Set(),
  adminMode: false,
  adminModePassword: process.env.ADMIN_MODE_PASSWORD || 'admin123' // Default password, should be changed in production
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

// Check if admin mode is enabled
function isAdminMode() {
  return adminConfig.adminMode;
}

// Toggle admin mode
function setAdminMode(enabled, password) {
  if (password !== adminConfig.adminModePassword) {
    return { success: false, message: 'Invalid admin password' };
  }
  adminConfig.adminMode = enabled;
  return { success: true, message: `Admin mode ${enabled ? 'enabled' : 'disabled'}` };
}

// Update admin mode password
function updateAdminPassword(newPassword, currentPassword) {
  if (currentPassword !== adminConfig.adminModePassword) {
    return { success: false, message: 'Current password is incorrect' };
  }
  adminConfig.adminModePassword = newPassword;
  return { success: true, message: 'Admin password updated' };
}

module.exports = {
  isAdmin,
  addAdmin,
  removeAdmin,
  isAdminMode,
  setAdminMode,
  updateAdminPassword,
  getAdminUsers,
  reloadAdminUsers,
  isAuthRequired
};
