// src/lib/services/secureStorage.ts
// IndexedDB-based secure storage for encrypted keys and preferences
// Uses NIP-49 encryption format exclusively

import { BROWSER as browser } from 'esm-env';
import type {
  SecureStorageSchema,
  Ncryptsec,
  Ncryptmnem,
  PINHash,
  StoredCredential,
  SecurityPreferences,
  PublicKeyHex,
  WebAuthnEncryptionKey,
  AuthMethod,
  PinLength,
} from '$lib/types/security.js';
import {
  DEFAULT_SECURITY_PREFERENCES,
  CURRENT_SCHEMA_VERSION,
  isNip49EncryptedKey,
  isNip49EncryptedMnemonic,
} from '$lib/types/security.js';

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = 'plebtap-secure-storage';
const DB_VERSION = 1;
const STORE_NAME = 'security';
const PRIMARY_KEY = 'primary';

// ============================================================================
// Database Initialization
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Get or create the IndexedDB database
 */
function getDatabase(): Promise<IDBDatabase> {
  if (!browser) {
    return Promise.reject(new Error('IndexedDB is not available in non-browser environment'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open secure storage database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create the object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
}

/**
 * Get a transaction and object store
 */
async function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await getDatabase();
  const transaction = db.transaction(STORE_NAME, mode);
  return transaction.objectStore(STORE_NAME);
}

// ============================================================================
// Default Schema
// ============================================================================

function createDefaultSchema(): SecureStorageSchema {
  return {
    encryptedKey: null,
    encryptedMnemonic: null,
    pinHash: null,
    webauthnCredential: null,
    webauthnEncryptionKey: null,
    preferences: { ...DEFAULT_SECURITY_PREFERENCES },
    publicKeyHex: null,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

// ============================================================================
// Core Storage Operations
// ============================================================================

/**
 * Read the complete storage schema
 */
export async function readStorage(): Promise<SecureStorageSchema> {
  if (!browser) {
    return createDefaultSchema();
  }

  try {
    const store = await getStore('readonly');
    
    return new Promise((resolve, reject) => {
      const request = store.get(PRIMARY_KEY);
      
      request.onerror = () => {
        reject(new Error('Failed to read secure storage'));
      };
      
      request.onsuccess = () => {
        if (request.result) {
          // Validate and return, merging with defaults for any missing fields
          const stored = request.result.data as Partial<SecureStorageSchema>;
          resolve({
            ...createDefaultSchema(),
            ...stored,
            preferences: {
              ...DEFAULT_SECURITY_PREFERENCES,
              ...(stored.preferences || {}),
            },
          });
        } else {
          resolve(createDefaultSchema());
        }
      };
    });
  } catch (error) {
    console.error('Error reading secure storage:', error);
    return createDefaultSchema();
  }
}

/**
 * Write the complete storage schema
 */
export async function writeStorage(schema: SecureStorageSchema): Promise<void> {
  if (!browser) {
    throw new Error('IndexedDB is not available in non-browser environment');
  }

  const store = await getStore('readwrite');
  
  return new Promise((resolve, reject) => {
    const request = store.put({
      id: PRIMARY_KEY,
      data: schema,
      updatedAt: Date.now(),
    });
    
    request.onerror = () => {
      reject(new Error('Failed to write secure storage'));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Type for storage updates that allows partial preferences
 */
type StorageUpdates = Omit<Partial<SecureStorageSchema>, 'preferences'> & {
  preferences?: Partial<SecurityPreferences>;
};

/**
 * Update specific fields in storage
 */
export async function updateStorage(
  updates: StorageUpdates
): Promise<SecureStorageSchema> {
  const current = await readStorage();
  const updated: SecureStorageSchema = {
    ...current,
    ...updates,
    preferences: {
      ...current.preferences,
      ...(updates.preferences || {}),
    },
  };
  await writeStorage(updated);
  return updated;
}

// ============================================================================
// Encrypted Key Operations
// ============================================================================

/**
 * Store an encrypted private key in NIP-49 format (ncryptsec1...)
 */
export async function storeEncryptedKey(
  ncryptsec: Ncryptsec,
  publicKeyHex: PublicKeyHex
): Promise<void> {
  await updateStorage({
    encryptedKey: ncryptsec,
    publicKeyHex,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

/**
 * Get the stored encrypted key
 */
export async function getEncryptedKey(): Promise<Ncryptsec | null> {
  const storage = await readStorage();
  return storage.encryptedKey;
}

/**
 * Check if an encrypted key is stored
 */
export async function hasEncryptedKey(): Promise<boolean> {
  const key = await getEncryptedKey();
  return key !== null && isNip49EncryptedKey(key);
}

/**
 * Get the stored public key
 */
export async function getPublicKey(): Promise<PublicKeyHex | null> {
  const storage = await readStorage();
  return storage.publicKeyHex;
}

// ============================================================================
// Mnemonic Operations
// ============================================================================

/**
 * Store an encrypted mnemonic in NIP-49 format (ncryptmnem1...)
 */
export async function storeEncryptedMnemonic(ncryptmnem: Ncryptmnem): Promise<void> {
  await updateStorage({ encryptedMnemonic: ncryptmnem });
}

/**
 * Get the stored encrypted mnemonic
 */
export async function getEncryptedMnemonic(): Promise<Ncryptmnem | null> {
  const storage = await readStorage();
  return storage.encryptedMnemonic;
}

/**
 * Check if an encrypted mnemonic is stored
 */
export async function hasEncryptedMnemonic(): Promise<boolean> {
  const mnemonic = await getEncryptedMnemonic();
  return mnemonic !== null && isNip49EncryptedMnemonic(mnemonic);
}

/**
 * Clear the stored encrypted mnemonic
 */
export async function clearEncryptedMnemonic(): Promise<void> {
  await updateStorage({ encryptedMnemonic: null });
}

// ============================================================================
// PIN Operations
// ============================================================================

/**
 * Store PIN hash for verification
 */
export async function storePinHash(pinHash: PINHash, pinLength: PinLength): Promise<void> {
  await updateStorage({
    pinHash,
    preferences: {
      authMethod: 'pin',
      pinLength,
    },
  });
}

/**
 * Get stored PIN hash
 */
export async function getPinHash(): Promise<PINHash | null> {
  const storage = await readStorage();
  return storage.pinHash;
}

/**
 * Check if PIN auth is set up
 */
export async function hasPinSetup(): Promise<boolean> {
  const storage = await readStorage();
  return storage.preferences.authMethod === 'pin' && storage.pinHash !== null;
}

/**
 * Get the configured PIN length
 */
export async function getPinLength(): Promise<PinLength> {
  const storage = await readStorage();
  return storage.preferences.pinLength;
}

/**
 * Get the configured auth method
 */
export async function getAuthMethod(): Promise<AuthMethod> {
  const storage = await readStorage();
  return storage.preferences.authMethod;
}

/**
 * Record a failed PIN attempt
 */
export async function recordFailedPinAttempt(): Promise<number> {
  const storage = await readStorage();
  const newCount = storage.preferences.failedPinAttempts + 1;
  
  await updateStorage({
    preferences: {
      failedPinAttempts: newCount,
      lastFailedAttemptAt: Date.now(),
    },
  });
  
  return newCount;
}

/**
 * Reset failed PIN attempts
 */
export async function resetFailedPinAttempts(): Promise<void> {
  await updateStorage({
    preferences: {
      failedPinAttempts: 0,
      lastFailedAttemptAt: null,
    },
  });
}

/**
 * Get failed PIN attempts info
 */
export async function getFailedPinAttempts(): Promise<{
  count: number;
  lastAttemptAt: number | null;
}> {
  const storage = await readStorage();
  return {
    count: storage.preferences.failedPinAttempts,
    lastAttemptAt: storage.preferences.lastFailedAttemptAt,
  };
}

// ============================================================================
// WebAuthn Operations
// ============================================================================

/**
 * Store WebAuthn credential and encryption key
 */
export async function storeWebAuthnCredential(
  credential: StoredCredential,
  encryptionKey: WebAuthnEncryptionKey
): Promise<void> {
  await updateStorage({
    webauthnCredential: credential,
    webauthnEncryptionKey: encryptionKey,
    preferences: {
      authMethod: 'webauthn',
    },
  });
}

/**
 * Get stored WebAuthn credential
 */
export async function getWebAuthnCredential(): Promise<StoredCredential | null> {
  const storage = await readStorage();
  return storage.webauthnCredential;
}

/**
 * Get stored WebAuthn encryption key
 */
export async function getWebAuthnEncryptionKey(): Promise<WebAuthnEncryptionKey | null> {
  const storage = await readStorage();
  return storage.webauthnEncryptionKey;
}

/**
 * Check if WebAuthn auth is set up
 */
export async function hasWebAuthnSetup(): Promise<boolean> {
  const storage = await readStorage();
  return storage.preferences.authMethod === 'webauthn' && 
    storage.webauthnCredential !== null &&
    storage.webauthnEncryptionKey !== null;
}

/**
 * Remove WebAuthn credential and key
 */
export async function removeWebAuthnCredential(): Promise<void> {
  await updateStorage({
    webauthnCredential: null,
    webauthnEncryptionKey: null,
    preferences: {
      authMethod: 'none',
    },
  });
}

// ============================================================================
// Unlock Session
// ============================================================================

/**
 * Record successful unlock
 */
export async function recordUnlock(): Promise<void> {
  await updateStorage({
    preferences: {
      lastUnlockAt: Date.now(),
      failedPinAttempts: 0,
      lastFailedAttemptAt: null,
    },
  });
}

/**
 * Get last unlock timestamp
 */
export async function getLastUnlockTime(): Promise<number | null> {
  const storage = await readStorage();
  return storage.preferences.lastUnlockAt;
}

// ============================================================================
// Security Preferences
// ============================================================================

/**
 * Get all security preferences
 */
export async function getSecurityPreferences(): Promise<SecurityPreferences> {
  const storage = await readStorage();
  return storage.preferences;
}

/**
 * Update security preferences
 */
export async function updateSecurityPreferences(
  updates: Partial<SecurityPreferences>
): Promise<void> {
  await updateStorage({
    preferences: updates,
  });
}

// ============================================================================
// Cleanup & Reset
// ============================================================================

/**
 * Clear all secure storage data
 */
export async function clearSecureStorage(): Promise<void> {
  if (!browser) {
    return;
  }

  try {
    const store = await getStore('readwrite');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(PRIMARY_KEY);
      
      request.onerror = () => {
        reject(new Error('Failed to clear secure storage'));
      };
      
      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.error('Error clearing secure storage:', error);
  }
}

/**
 * Delete the entire database
 */
export async function deleteSecureStorageDatabase(): Promise<void> {
  if (!browser) {
    return;
  }

  // Close any open connections
  dbPromise = null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onerror = () => {
      reject(new Error('Failed to delete secure storage database'));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
}

// ============================================================================
// Extension Login Marker (stored in IndexedDB)
// ============================================================================

const EXTENSION_LOGIN_STORE = 'extension-login';

/**
 * Store extension login marker
 */
export async function storeExtensionLoginMarker(): Promise<void> {
  if (!browser) return;
  
  const db = await getDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.put({
      id: EXTENSION_LOGIN_STORE,
      isExtensionLogin: true,
      createdAt: Date.now(),
    });
    
    request.onerror = () => reject(new Error('Failed to store extension login marker'));
    request.onsuccess = () => resolve();
  });
}

/**
 * Check if extension login marker exists
 */
export async function hasExtensionLoginMarker(): Promise<boolean> {
  if (!browser) return false;
  
  try {
    const db = await getDatabase();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve) => {
      const request = store.get(EXTENSION_LOGIN_STORE);
      
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        resolve(!!request.result?.isExtensionLogin);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Clear extension login marker
 */
export async function clearExtensionLoginMarker(): Promise<void> {
  if (!browser) return;
  
  try {
    const db = await getDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve) => {
      const request = store.delete(EXTENSION_LOGIN_STORE);
      request.onerror = () => resolve();
      request.onsuccess = () => resolve();
    });
  } catch {
    // Ignore errors
  }
}
