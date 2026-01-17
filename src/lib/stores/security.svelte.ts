// src/lib/stores/security.svelte.ts
// Svelte 5 runes-based security state management
// Implements PIN OR WebAuthn authentication (user chooses one)

import { BROWSER as browser } from 'esm-env';
import type {
  SecurityState,
  DecryptedKey,
  UnlockResult,
  PIN,
  PinLength,
  AuthMethod,
  WebAuthnEncryptionKey,
} from '$lib/types/security.js';
import {
  PIN_RATE_LIMIT,
  UNLOCK_SESSION_DURATION,
  isValidPIN,
} from '$lib/types/security.js';
import {
  encryptPrivateKey,
  decryptPrivateKey,
  encryptWithKey,
  decryptWithKey,
  encryptMnemonic,
  decryptMnemonic,
  encryptMnemonicWithKey,
  decryptMnemonicWithKey,
  hashPinForVerification,
  verifyPin,
  privateKeyToKeyPair,
  publicKeyToNpub,
} from '$lib/services/crypto.js';
import type { Mnemonic } from '$lib/types/security.js';
import {
  readStorage,
  storeEncryptedKey,
  storeEncryptedMnemonic,
  getEncryptedMnemonic,
  hasEncryptedMnemonic,
  storePinHash,
  getPinHash,
  hasPinSetup,
  recordFailedPinAttempt,
  resetFailedPinAttempts,
  getFailedPinAttempts,
  recordUnlock,
  storeWebAuthnCredential,
  getWebAuthnCredential,
  getWebAuthnEncryptionKey,
  hasWebAuthnSetup,
  removeWebAuthnCredential,
  getEncryptedKey,
  hasEncryptedKey,
  clearSecureStorage,
  getAuthMethod,
  getPinLength,
  updateSecurityPreferences,
  getStoredNpub,
} from '$lib/services/secureStorage.js';
import {
  isPlatformAuthenticatorAvailable,
  registerCredential,
  requestUserVerification,
  createStoredCredential,
} from '$lib/services/webauthn.js';
import type { PrivateKeyHex, PublicKeyHex } from '$lib/types/security.js';

// ============================================================================
// Reactive State
// ============================================================================

/**
 * Current security state (including initialization status)
 */
export const securityState = $state<SecurityState & { isInitializing: boolean; storedNpub: string | null; autoLockEnabled: boolean }>({
  authMethod: 'none',
  pinLength: 6,
  webauthnAvailable: false,
  hasStoredKey: false,
  isUnlocked: false,
  unlockExpiresAt: null,
  isInitializing: true,
  storedNpub: null,
  autoLockEnabled: false,
});

/**
 * Currently unlocked key (cleared after session expires)
 */
let currentUnlockedKey: DecryptedKey | null = $state(null);

/**
 * Session timeout handle
 */
let unlockTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// Derived State
// ============================================================================

/**
 * Returns true if wallet is in a locked state (has secured key but not unlocked)
 * This is used by the UI to show the locked indicator
 */
export function isWalletLocked(): boolean {
  return (
    securityState.hasStoredKey &&
    securityState.authMethod !== 'none' &&
    !securityState.isUnlocked
  );
}

/**
 * Returns true if wallet is secured (not using insecure storage)
 */
export function isWalletSecured(): boolean {
  return securityState.hasStoredKey && securityState.authMethod !== 'none';
}

/**
 * Set the wallet as unlocked with the given key
 * Used after setup or unlock operations
 */
function setUnlockedState(key: DecryptedKey): void {
  currentUnlockedKey = key;
  securityState.isUnlocked = true;
  securityState.unlockExpiresAt = Date.now() + UNLOCK_SESSION_DURATION;
  
  // Clear any existing timeout
  if (unlockTimeoutHandle) {
    clearTimeout(unlockTimeoutHandle);
  }
  
  // Note: Session timeout is set elsewhere (in setSessionTimeout)
  // For initial setup, we don't auto-lock immediately
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the security store
 * Call this on app startup
 */
export async function initializeSecurity(): Promise<void> {
  if (!browser) return;

  try {
    securityState.isInitializing = true;
    
    // Check WebAuthn availability
    const webauthnAvailable = await isPlatformAuthenticatorAvailable();
    
    // Load stored state
    const [authMethod, pinLength, hasKey, storedNpub, storage] = await Promise.all([
      getAuthMethod(),
      getPinLength(),
      hasEncryptedKey(),
      getStoredNpub(),
      readStorage(),
    ]);

    // Update state
    securityState.authMethod = authMethod;
    securityState.pinLength = pinLength;
    securityState.webauthnAvailable = webauthnAvailable;
    securityState.hasStoredKey = hasKey;
    securityState.isUnlocked = false;
    securityState.unlockExpiresAt = null;
    securityState.storedNpub = storedNpub;
    securityState.autoLockEnabled = storage.preferences.autoLockEnabled ?? false;

  } catch (error) {
    console.error('Failed to initialize security:', error);
  } finally {
    securityState.isInitializing = false;
  }
}

// ============================================================================
// PIN Authentication Setup
// ============================================================================

/**
 * Set up PIN authentication
 * Encrypts the private key with a user-chosen PIN
 * Optionally encrypts and stores a mnemonic
 */
export async function setupPINAuth(
  privateKeyHex: PrivateKeyHex,
  publicKeyHex: PublicKeyHex,
  pin: string,
  pinLength: PinLength,
  mnemonic?: Mnemonic
): Promise<{ success: boolean; error?: string }> {
  if (!isValidPIN(pin, pinLength)) {
    return { success: false, error: `PIN must be exactly ${pinLength} digits` };
  }

  const typedPin = pin as PIN;

  try {
    // Encrypt the private key with the PIN
    const encryptedBlob = encryptPrivateKey(privateKeyHex, typedPin);
    
    // Create PIN hash for verification
    const pinHash = hashPinForVerification(typedPin);
    
    // Convert to npub for storage (available when locked)
    const npub = publicKeyToNpub(publicKeyHex);
    
    // Store both
    await storeEncryptedKey(encryptedBlob, publicKeyHex, npub);
    await storePinHash(pinHash, pinLength);
    
    // Optionally encrypt and store mnemonic
    if (mnemonic) {
      const encryptedMnemonic = encryptMnemonic(mnemonic, typedPin);
      await storeEncryptedMnemonic(encryptedMnemonic);
    }
    
    // Update state
    securityState.authMethod = 'pin';
    securityState.pinLength = pinLength;
    securityState.hasStoredKey = true;
    
    // Mark as unlocked immediately after setup (user just authenticated)
    const decryptedKey = privateKeyToKeyPair(privateKeyHex);
    if (mnemonic) {
      (decryptedKey as DecryptedKey & { mnemonic?: Mnemonic }).mnemonic = mnemonic;
    }
    setUnlockedState(decryptedKey);

    return { success: true };
  } catch (error) {
    console.error('Failed to set up PIN:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set up PIN',
    };
  }
}

/**
 * Change the PIN
 */
export async function changePIN(
  oldPin: string,
  newPin: string,
  newPinLength: PinLength
): Promise<{ success: boolean; error?: string }> {
  if (!isValidPIN(newPin, newPinLength)) {
    return { success: false, error: `New PIN must be exactly ${newPinLength} digits` };
  }

  try {
    // First, unlock with old PIN to get the key
    const unlockResult = await unlockWithPIN(oldPin);
    if (!unlockResult.success || !unlockResult.key) {
      return { success: false, error: unlockResult.error || 'Incorrect PIN' };
    }

    // Re-encrypt with new PIN
    const result = await setupPINAuth(
      unlockResult.key.privateKeyHex,
      unlockResult.key.publicKeyHex,
      newPin,
      newPinLength
    );

    return result;
  } catch (error) {
    console.error('Failed to change PIN:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change PIN',
    };
  }
}

// ============================================================================
// WebAuthn Authentication Setup
// ============================================================================

/**
 * Generate a random 256-bit encryption key for WebAuthn
 */
function generateRandomEncryptionKey(): string {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return btoa(String.fromCharCode(...key));
}

/**
 * Set up WebAuthn authentication
 * Encrypts the private key with a random key that's stored in IndexedDB
 * The random key is only accessible after WebAuthn verification succeeds
 * Optionally encrypts and stores a mnemonic
 */
export async function setupWebAuthnAuth(
  privateKeyHex: PrivateKeyHex,
  publicKeyHex: PublicKeyHex,
  mnemonic?: Mnemonic
): Promise<{ success: boolean; error?: string }> {
  if (!securityState.webauthnAvailable) {
    return { success: false, error: 'WebAuthn is not available on this device' };
  }

  try {
    // Step 1: Register WebAuthn credential
    const registration = await registerCredential(publicKeyHex, 'PlebTap Wallet');
    const storedCredential = createStoredCredential(registration);
    
    // Step 2: Generate random encryption key
    const randomKey = generateRandomEncryptionKey();
    const encryptionKeyData: WebAuthnEncryptionKey = {
      key: randomKey,
      createdAt: Date.now(),
    };
    
    // Step 3: Encrypt private key with the random key (using key-based encryption)
    const encryptedBlob = encryptWithKey(privateKeyHex, randomKey);
    
    // Convert to npub for storage (available when locked)
    const npub = publicKeyToNpub(publicKeyHex);
    
    // Step 4: Store everything
    await storeEncryptedKey(encryptedBlob, publicKeyHex, npub);
    await storeWebAuthnCredential(storedCredential, encryptionKeyData);
    
    // Optionally encrypt and store mnemonic
    if (mnemonic) {
      const encryptedMnemonic = encryptMnemonicWithKey(mnemonic, randomKey);
      await storeEncryptedMnemonic(encryptedMnemonic);
    }
    
    // Update state
    securityState.authMethod = 'webauthn';
    securityState.hasStoredKey = true;
    
    // Mark as unlocked immediately after setup (user just authenticated via biometric)
    const decryptedKey = privateKeyToKeyPair(privateKeyHex);
    if (mnemonic) {
      (decryptedKey as DecryptedKey & { mnemonic?: Mnemonic }).mnemonic = mnemonic;
    }
    setUnlockedState(decryptedKey);

    return { success: true };
  } catch (error) {
    console.error('Failed to set up WebAuthn:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'WebAuthn setup failed',
    };
  }
}

/**
 * Disable WebAuthn (user must set up new auth method)
 */
export async function disableWebAuthn(): Promise<void> {
  await removeWebAuthnCredential();
  securityState.authMethod = 'none';
}

// ============================================================================
// Unlock Operations
// ============================================================================

/**
 * Check if rate limited due to failed attempts
 */
async function checkRateLimit(): Promise<{ limited: boolean; waitTime?: number }> {
  const { count, lastAttemptAt } = await getFailedPinAttempts();
  
  if (count < PIN_RATE_LIMIT.maxAttempts) {
    return { limited: false };
  }

  if (lastAttemptAt) {
    const timeSinceLastAttempt = Date.now() - lastAttemptAt;
    if (timeSinceLastAttempt < PIN_RATE_LIMIT.lockoutDuration) {
      const waitTime = PIN_RATE_LIMIT.lockoutDuration - timeSinceLastAttempt;
      return { limited: true, waitTime };
    }
    
    // Lockout period expired, reset
    await resetFailedPinAttempts();
  }

  return { limited: false };
}

/**
 * Get rate limit status (public function for UI)
 */
export async function getRateLimitStatus(): Promise<{ 
  limited: boolean; 
  waitTime?: number;
  attemptsRemaining: number;
  failedAttempts: number;
}> {
  const { count, lastAttemptAt } = await getFailedPinAttempts();
  
  if (count >= PIN_RATE_LIMIT.maxAttempts && lastAttemptAt) {
    const timeSinceLastAttempt = Date.now() - lastAttemptAt;
    if (timeSinceLastAttempt < PIN_RATE_LIMIT.lockoutDuration) {
      const waitTime = PIN_RATE_LIMIT.lockoutDuration - timeSinceLastAttempt;
      return { 
        limited: true, 
        waitTime,
        attemptsRemaining: 0,
        failedAttempts: count,
      };
    }
    // Lockout period expired
    await resetFailedPinAttempts();
    return { 
      limited: false, 
      attemptsRemaining: PIN_RATE_LIMIT.maxAttempts,
      failedAttempts: 0,
    };
  }

  return { 
    limited: false, 
    attemptsRemaining: PIN_RATE_LIMIT.maxAttempts - count,
    failedAttempts: count,
  };
}

/**
 * Unlock with PIN
 */
export async function unlockWithPIN(pin: string): Promise<UnlockResult> {
  if (securityState.authMethod !== 'pin') {
    return { success: false, error: 'PIN authentication is not set up' };
  }

  // Check rate limiting
  const rateLimit = await checkRateLimit();
  if (rateLimit.limited) {
    const seconds = Math.ceil((rateLimit.waitTime || 0) / 1000);
    return {
      success: false,
      error: `Too many failed attempts. Try again in ${seconds} seconds.`,
    };
  }

  if (!isValidPIN(pin, securityState.pinLength)) {
    return { success: false, error: `PIN must be ${securityState.pinLength} digits` };
  }

  const typedPin = pin as PIN;

  try {
    // Verify PIN against stored hash
    const storedHash = await getPinHash();
    if (storedHash && !verifyPin(typedPin, storedHash)) {
      await recordFailedPinAttempt();
      return { success: false, error: 'Incorrect PIN' };
    }

    // Get and decrypt the key
    const encryptedBlob = await getEncryptedKey();
    if (!encryptedBlob) {
      return { success: false, error: 'No encrypted key found' };
    }

    const decryptedKey = decryptPrivateKey(encryptedBlob, typedPin);
    
    // Try to decrypt mnemonic if available
    const encryptedMnemonic = await getEncryptedMnemonic();
    if (encryptedMnemonic) {
      try {
        decryptedKey.mnemonic = decryptMnemonic(encryptedMnemonic, typedPin);
      } catch {
        // Mnemonic decryption failed, but we still have the key
      }
    }
    
    // Record successful unlock
    await recordUnlock();
    
    // Set up session
    startUnlockSession(decryptedKey);

    return { success: true, key: decryptedKey };
  } catch (error) {
    await recordFailedPinAttempt();
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unlock failed',
    };
  }
}

/**
 * Unlock with WebAuthn (biometric/device authenticator)
 */
export async function unlockWithWebAuthn(): Promise<UnlockResult> {
  if (securityState.authMethod !== 'webauthn') {
    return { success: false, error: 'WebAuthn authentication is not set up' };
  }

  try {
    // Step 1: Get stored credential
    const credential = await getWebAuthnCredential();
    if (!credential) {
      return { success: false, error: 'No WebAuthn credential found' };
    }

    // Step 2: Verify user with WebAuthn
    const verified = await requestUserVerification(credential);
    if (!verified) {
      return { success: false, error: 'Biometric verification failed or was cancelled' };
    }

    // Step 3: Get the encryption key (only accessible after WebAuthn succeeds)
    const encryptionKeyData = await getWebAuthnEncryptionKey();
    if (!encryptionKeyData) {
      return { success: false, error: 'Encryption key not found' };
    }

    // Step 4: Decrypt the private key
    const encryptedBlob = await getEncryptedKey();
    if (!encryptedBlob) {
      return { success: false, error: 'No encrypted key found' };
    }

    const decryptedKey = decryptWithKey(encryptedBlob, encryptionKeyData.key);
    
    // Try to decrypt mnemonic if available
    const encryptedMnemonic = await getEncryptedMnemonic();
    if (encryptedMnemonic) {
      try {
        decryptedKey.mnemonic = decryptMnemonicWithKey(encryptedMnemonic, encryptionKeyData.key);
      } catch {
        // Mnemonic decryption failed, but we still have the key
      }
    }
    
    // Record successful unlock
    await recordUnlock();
    
    // Set up session
    startUnlockSession(decryptedKey);

    return { success: true, key: decryptedKey };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'WebAuthn unlock failed',
    };
  }
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Start an unlock session with expiration
 */
function startUnlockSession(key: DecryptedKey): void {
  // Clear any existing timeout
  if (unlockTimeoutHandle) {
    clearTimeout(unlockTimeoutHandle);
  }

  // Store the key
  currentUnlockedKey = key;
  
  // Mark as unlocked
  securityState.isUnlocked = true;

  // Only set up auto-lock if enabled
  if (securityState.autoLockEnabled) {
    const expiresAt = Date.now() + UNLOCK_SESSION_DURATION;
    securityState.unlockExpiresAt = expiresAt;
    
    unlockTimeoutHandle = setTimeout(() => {
      lockSession();
    }, UNLOCK_SESSION_DURATION);
  } else {
    securityState.unlockExpiresAt = null;
  }
}

/**
 * Lock the current session
 */
export function lockSession(): void {
  if (unlockTimeoutHandle) {
    clearTimeout(unlockTimeoutHandle);
    unlockTimeoutHandle = null;
  }

  if (currentUnlockedKey) {
    // Clear sensitive data (best effort)
    currentUnlockedKey.privateKeyHex = '' as PrivateKeyHex;
    currentUnlockedKey.nsec = '' as any;
    currentUnlockedKey = null;
  }

  securityState.isUnlocked = false;
  securityState.unlockExpiresAt = null;
}

/**
 * Get the currently unlocked key (if session is active)
 */
export function getUnlockedKey(): DecryptedKey | null {
  if (!securityState.isUnlocked) {
    return null;
  }
  
  // Check if session expired
  if (securityState.unlockExpiresAt && Date.now() > securityState.unlockExpiresAt) {
    lockSession();
    return null;
  }

  return currentUnlockedKey;
}

/**
 * Extend the unlock session
 */
export function extendUnlockSession(): void {
  if (!securityState.isUnlocked || !currentUnlockedKey) {
    return;
  }

  if (unlockTimeoutHandle) {
    clearTimeout(unlockTimeoutHandle);
  }

  const expiresAt = Date.now() + UNLOCK_SESSION_DURATION;
  securityState.unlockExpiresAt = expiresAt;

  unlockTimeoutHandle = setTimeout(() => {
    lockSession();
  }, UNLOCK_SESSION_DURATION);
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clear all security data (for logout)
 */
export async function clearAllSecurityData(): Promise<void> {
  lockSession();
  await clearSecureStorage();
  
  // Reset state
  securityState.authMethod = 'none';
  securityState.pinLength = 6;
  securityState.hasStoredKey = false;
  securityState.isUnlocked = false;
  securityState.unlockExpiresAt = null;
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Check if any authentication is set up
 */
export function hasAuthSetup(): boolean {
  return securityState.authMethod !== 'none';
}

/**
 * Check if sensitive operations should be allowed
 * Returns true if unlocked, or if no security is set up
 */
export function canPerformSensitiveOperation(): boolean {
  // If no auth is set up, allow (during initial setup)
  if (securityState.authMethod === 'none') {
    return true;
  }
  return securityState.isUnlocked;
}

/**
 * Perform unlock using the configured auth method
 */
export async function performUnlock(pin?: string): Promise<UnlockResult> {
  switch (securityState.authMethod) {
    case 'webauthn':
      return unlockWithWebAuthn();
    case 'pin':
      if (!pin) {
        return { success: false, error: 'PIN required' };
      }
      return unlockWithPIN(pin);
    case 'none':
      // If there's a stored key but no auth method, it's insecure storage
      if (securityState.hasStoredKey) {
        return unlockInsecure();
      }
      return { success: false, error: 'No authentication method set up' };
  }
}

// ============================================================================
// Insecure Storage (for users who skip security)
// ============================================================================

/**
 * Store key without authentication (insecure mode)
 * The key is stored encrypted with a fixed key - provides no real security
 * but maintains the same storage format for consistency
 */
/** Fixed key for insecure storage - provides NO SECURITY */
const INSECURE_STORAGE_KEY = 'insecure-plebtap-key';

export async function storeInsecurely(
  privateKeyHex: PrivateKeyHex,
  publicKeyHex: PublicKeyHex,
  mnemonic?: Mnemonic
): Promise<{ success: boolean; error?: string }> {
  try {
    // Encrypt with the fixed key (using key-based encryption, no PIN validation)
    const encryptedBlob = encryptWithKey(privateKeyHex, INSECURE_STORAGE_KEY);
    
    // Convert to npub for storage (available when locked)
    const npub = publicKeyToNpub(publicKeyHex);
    
    // Store
    await storeEncryptedKey(encryptedBlob, publicKeyHex, npub);
    
    // Optionally encrypt and store mnemonic
    if (mnemonic) {
      const encryptedMnemonic = encryptMnemonicWithKey(mnemonic, INSECURE_STORAGE_KEY);
      await storeEncryptedMnemonic(encryptedMnemonic);
    }
    
    // Mark as no auth (insecure)
    await updateSecurityPreferences({ authMethod: 'none' });
    
    // Update state
    securityState.authMethod = 'none';
    securityState.hasStoredKey = true;
    
    // Mark as unlocked immediately (insecure = always unlocked)
    const decryptedKey = privateKeyToKeyPair(privateKeyHex);
    if (mnemonic) {
      (decryptedKey as DecryptedKey & { mnemonic?: Mnemonic }).mnemonic = mnemonic;
    }
    setUnlockedState(decryptedKey);

    return { success: true };
  } catch (error) {
    console.error('Failed to store insecurely:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store key',
    };
  }
}

/**
 * Unlock insecurely stored key
 */
export async function unlockInsecure(): Promise<UnlockResult> {
  try {
    const encryptedBlob = await getEncryptedKey();
    if (!encryptedBlob) {
      return { success: false, error: 'No encrypted key found' };
    }

    const decryptedKey = decryptWithKey(encryptedBlob, INSECURE_STORAGE_KEY);
    
    // Try to decrypt mnemonic if available
    const encryptedMnemonic = await getEncryptedMnemonic();
    if (encryptedMnemonic) {
      try {
        decryptedKey.mnemonic = decryptMnemonicWithKey(encryptedMnemonic, INSECURE_STORAGE_KEY);
      } catch {
        // Mnemonic decryption failed, but we still have the key
      }
    }
    
    // Record successful unlock
    await recordUnlock();
    
    // Set up session
    startUnlockSession(decryptedKey);

    return { success: true, key: decryptedKey };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unlock failed',
    };
  }
}

// ============================================================================
// Mnemonic Export
// ============================================================================

/**
 * Check if a mnemonic is stored (for showing export option in UI)
 */
export async function hasMnemonicStored(): Promise<boolean> {
  return hasEncryptedMnemonic();
}

/**
 * Export the mnemonic (requires unlock with PIN)
 * @param pin - User's PIN for decryption
 * @returns The mnemonic if successful
 */
export async function exportMnemonic(pin: string): Promise<{ success: boolean; mnemonic?: Mnemonic; error?: string }> {
  try {
    const encryptedMnemonic = await getEncryptedMnemonic();
    if (!encryptedMnemonic) {
      return { success: false, error: 'No mnemonic stored' };
    }

    let mnemonic: Mnemonic;
    
    if (securityState.authMethod === 'pin') {
      mnemonic = decryptMnemonic(encryptedMnemonic, pin as PIN);
    } else if (securityState.authMethod === 'webauthn') {
      // For WebAuthn, need to get the random key
      const encryptionKey = await getWebAuthnEncryptionKey();
      if (!encryptionKey) {
        return { success: false, error: 'WebAuthn key not found' };
      }
      mnemonic = decryptMnemonicWithKey(encryptedMnemonic, encryptionKey.key);
    } else {
      // Insecure storage
      mnemonic = decryptMnemonicWithKey(encryptedMnemonic, INSECURE_STORAGE_KEY);
    }

    return { success: true, mnemonic };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export mnemonic',
    };
  }
}
