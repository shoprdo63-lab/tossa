/**
 * AliSmart Secure Storage Encryption
 * Provides client-side encryption for sensitive user data
 * Uses AES-GCM encryption with a key derived from extension ID
 * All data stays local - no external servers
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Derives encryption key from extension ID
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey() {
  const extensionId = chrome.runtime.id || 'alismart-finder-default-key';
  
  // Create a salt from extension ID
  const encoder = new TextEncoder();
  const salt = encoder.encode(extensionId.slice(0, 16));
  
  // Import raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(extensionId),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive AES key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data before storage
 * @param {Object} data - Data to encrypt
 * @returns {Promise<{encrypted: string, iv: string}>}
 */
export async function encryptData(data) {
  try {
    const key = await deriveKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoder.encode(JSON.stringify(data))
    );
    
    return {
      encrypted: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv)
    };
  } catch (error) {
    console.error('[AliSmart Crypto] Encryption failed:', error);
    throw error;
  }
}

/**
 * Decrypts data from storage
 * @param {{encrypted: string, iv: string}} storedData
 * @returns {Promise<Object>}
 */
export async function decryptData(storedData) {
  try {
    const key = await deriveKey();
    const decoder = new TextDecoder();
    
    const encrypted = base64ToArrayBuffer(storedData.encrypted);
    const iv = base64ToArrayBuffer(storedData.iv);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );
    
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    console.error('[AliSmart Crypto] Decryption failed:', error);
    throw error;
  }
}

/**
 * Converts ArrayBuffer to Base64
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 to ArrayBuffer
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Secure storage wrapper with encryption
 */
export const secureStorage = {
  async set(key, data) {
    const encrypted = await encryptData(data);
    await chrome.storage.local.set({ [key]: encrypted });
  },
  
  async get(key) {
    const result = await chrome.storage.local.get(key);
    if (!result[key]) return null;
    return await decryptData(result[key]);
  },
  
  async remove(key) {
    await chrome.storage.local.remove(key);
  }
};

console.log('🚀 AliSmart: CryptoUtils Loaded');
