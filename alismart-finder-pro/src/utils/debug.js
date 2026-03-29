/**
 * AliSmart Debug Utility
 * Provides standardized module load logging for debugging extension lifecycle
 */

/**
 * Logs module loading with standardized format
 * @param {string} moduleName - Name of the module being loaded
 */
export function logModuleLoad(moduleName) {
  console.log(`🚀 AliSmart: ${moduleName} Loaded`);
}

/**
 * Logs module initialization with timestamp
 * @param {string} moduleName - Name of the module
 */
export function logModuleInit(moduleName) {
  console.log(`🚀 AliSmart: ${moduleName} Initialized [${new Date().toISOString()}]`);
}

/**
 * Logs a lifecycle event
 * @param {string} component - Component name
 * @param {string} event - Event type (mount, unmount, update, etc.)
 */
export function logLifecycle(component, event) {
  console.log(`🔄 AliSmart: ${component} ${event}`);
}

/**
 * Logs communication between extension parts
 * @param {string} from - Source module
 * @param {string} to - Target module
 * @param {string} message - Message type
 */
export function logCommunication(from, to, message) {
  console.log(`📡 AliSmart: ${from} → ${to}: ${message}`);
}

/**
 * Logs sidebar/iframe events
 * @param {string} action - Action performed
 * @param {Object} details - Additional details
 */
export function logSidebar(action, details = {}) {
  console.log(`📋 AliSmart Sidebar: ${action}`, details);
}

/**
 * Logs errors with standardized format
 * @param {string} context - Where the error occurred
 * @param {Error|string} error - Error object or message
 */
export function logError(context, error) {
  const errorMessage = error instanceof Error ? error.message : error;
  console.error(`❌ AliSmart Error [${context}]:`, errorMessage);
  if (error instanceof Error && error.stack) {
    console.error(`📍 Stack:`, error.stack);
  }
}

// Log that debug module itself is loaded
logModuleLoad('DebugUtils');
