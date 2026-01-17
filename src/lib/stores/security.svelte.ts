// src/lib/stores/security.svelte.ts
// Svelte 5 runes-based security state management
// Implements PIN OR WebAuthn authentication (user chooses one)
// Uses NIP-49 encryption exclusively (scrypt + XChaCha20-Poly1305)

import { BROWSER as browser } from 'esm-env';
import type {
  SecurityState,
  DecryptedKey,
  UnlockResult,
  PIN,
  PinLength,
  WebAuthnEncryptionKey,
  Ncryptsec,
  Ncryptmnem,
  Mnemonic,
  PrivateKeyHex,
  PublicKeyHex,
} from '$lib/types/security.js';
import {
  PIN_RATE_LIMIT,
  UNLOCK_SESSION_DURATION,
  isValidPIN,
} from '$lib/types/security.js';
import {
  hashPinForVerification,
  verifyPin,
  privateKeyToKeyPair,
  publicKeyToNpub,
} from '$lib/services/crypto.js';
import {
  encryptPrivateKeyNip49,
  decryptPrivateKeyNip49,
  encryptMnemonicNip49,
  decryptMnemonicNip49,
  NIP49_DEFAULT_LOGN,
  NIP49_FAST_LOGN,
} from '$lib/utils/nip49.js';
import {
  readStorage,
  storeEncryptedKey,
  storeEncryptedMnemonic,
  getEncryptedMnemonic,
  hasEncryptedMnemonic,
  storePinHash,
  getPinHash,
  recordFailedPinAttempt,
  resetFailedPinAttempts,
  getFailedPinAttempts,
  recordUnlock,
  storeWebAuthnCredential,
  getWebAuthnCredential,
  getWebAuthnEncryptionKey,
  removeWebAuthnCredential,
  getEncryptedKey,
  hasEncryptedKey,
  clearSecureStorage,
  getAuthMethod,
  getPinLength,
  updateSecurityPreferences,
  getPublicKey,
} from '$lib/services/secureStorage.js';
import {
  isPlatformAuthenticatorAvailable,
  registerCredential,
  requestUserVerification,
  createStoredCredential,
} from '$lib/services/webauthn.js';

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
    const [authMethod, pinLength, hasKey, publicKeyHex, storage] = await Promise.all([
      getAuthMethod(),
      getPinLength(),
      hasEncryptedKey(),
      getPublicKey(),
      readStorage(),
    ]);

    // Derive npub from publicKeyHex if available
    const storedNpub = publicKeyHex ? publicKeyToNpub(publicKeyHex) : null;

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
 * Set up PIN authentication using NIP-49 encryption
 * Encrypts the private key with a user-chosen PIN using scrypt + XChaCha20-Poly1305
 * Always encrypts and stores the mnemonic if provided
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
    // Encrypt the private key with NIP-49 (scrypt + XChaCha20-Poly1305)
    const ncryptsec = encryptPrivateKeyNip49(privateKeyHex, typedPin, NIP49_DEFAULT_LOGN) as Ncryptsec;
    
    // Create PIN hash for verification (faster than full decryption)
    const pinHash = hashPinForVerification(typedPin);
    
    // Store the encrypted key and PIN hash
    await storeEncryptedKey(ncryptsec, publicKeyHex);
    await storePinHash(pinHash, pinLength);
    
    // Always encrypt and store mnemonic if provided
    if (mnemonic) {
      const ncryptmnem = encryptMnemonicNip49(mnemonic, typedPin, NIP49_DEFAULT_LOGN) as Ncryptmnem;
      await storeEncryptedMnemonic(ncryptmnem);
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
      newPinLength,
      unlockResult.key.mnemonic
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
 * Set up WebAuthn authentication using NIP-49 encryption
 * Encrypts the private key with a random key using scrypt + XChaCha20-Poly1305
 * The random key is stored in IndexedDB and only accessible after WebAuthn verification
 * Always encrypts and stores the mnemonic if provided
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
    
    // Step 2: Generate random encryption key (used as password for NIP-49)
    const randomKey = generateRandomEncryptionKey();
    const encryptionKeyData: WebAuthnEncryptionKey = {
      key: randomKey,
      createdAt: Date.now(),
    };
    
    // Step 3: Encrypt private key with NIP-49 using the random key as password
    const ncryptsec = encryptPrivateKeyNip49(privateKeyHex, randomKey, NIP49_DEFAULT_LOGN) as Ncryptsec;
    
    // Step 4: Store everything
    await storeEncryptedKey(ncryptsec, publicKeyHex);
    await storeWebAuthnCredential(storedCredential, encryptionKeyData);
    
    // Always encrypt and store mnemonic if provided
    if (mnemonic) {
      const ncryptmnem = encryptMnemonicNip49(mnemonic, randomKey, NIP49_DEFAULT_LOGN) as Ncryptmnem;
      await storeEncryptedMnemonic(ncryptmnem);
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

/**
 * Rotate WebAuthn credential
 * This allows users to re-register their biometric authentication with a new credential
 * while maintaining access to their encrypted keys
 */
export async function rotateWebAuthnCredential(): Promise<{ success: boolean; error?: string }> {
  if (securityState.authMethod !== 'webauthn') {
    return { success: false, error: 'WebAuthn authentication is not set up' };
  }

  try {
    // Step 1: Get current credential and verify user
    const oldCredential = await getWebAuthnCredential();
    if (!oldCredential) {
      return { success: false, error: 'No WebAuthn credential found' };
    }

    const verified = await requestUserVerification(oldCredential);
    if (!verified) {
      return { success: false, error: 'Biometric verification failed or was cancelled' };
    }

    // Step 2: Get current encryption key and decrypt private key
    const oldEncryptionKey = await getWebAuthnEncryptionKey();
    if (!oldEncryptionKey) {
      return { success: false, error: 'Encryption key not found' };
    }

    const encryptedKey = await getEncryptedKey();
    if (!encryptedKey) {
      return { success: false, error: 'No encrypted key found' };
    }

    // Decrypt the private key
    const privateKeyHex = decryptPrivateKeyNip49(encryptedKey, oldEncryptionKey.key);

    // Decrypt mnemonic if present
    let mnemonic: Mnemonic | undefined;
    const encryptedMnemonic = await getEncryptedMnemonic();
    if (encryptedMnemonic) {
      try {
        mnemonic = decryptMnemonicNip49(encryptedMnemonic, oldEncryptionKey.key);
      } catch {
        // Mnemonic decryption failed, continue with key rotation
        console.warn('Mnemonic decryption failed during rotation');
      }
    }

    // Step 3: Get public key for new credential registration
    const publicKeyHex = await getPublicKey();
    if (!publicKeyHex) {
      return { success: false, error: 'Public key not found' };
    }

    // Step 4: Register NEW WebAuthn credential
    const newRegistration = await registerCredential(publicKeyHex, 'PlebTap Wallet');
    const newStoredCredential = createStoredCredential(newRegistration);

    // Step 5: Generate NEW random encryption key
    const newRandomKey = generateRandomEncryptionKey();
    const newEncryptionKeyData: WebAuthnEncryptionKey = {
      key: newRandomKey,
      createdAt: Date.now(),
    };

    // Step 6: Re-encrypt with new key using NIP-49
    const ncryptsec = encryptPrivateKeyNip49(privateKeyHex, newRandomKey, NIP49_DEFAULT_LOGN) as Ncryptsec;

    // Step 7: Store new credential and encrypted data
    await storeEncryptedKey(ncryptsec, publicKeyHex);
    await storeWebAuthnCredential(newStoredCredential, newEncryptionKeyData);

    // Re-encrypt and store mnemonic if present
    if (mnemonic) {
      const ncryptmnem = encryptMnemonicNip49(mnemonic, newRandomKey, NIP49_DEFAULT_LOGN) as Ncryptmnem;
      await storeEncryptedMnemonic(ncryptmnem);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to rotate WebAuthn credential:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Credential rotation failed',
    };
  }
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
    // Verify PIN against stored hash (faster than full decryption)
    const storedHash = await getPinHash();
    if (storedHash && !verifyPin(typedPin, storedHash)) {
      await recordFailedPinAttempt();
      return { success: false, error: 'Incorrect PIN' };
    }

    // Get and decrypt the key
    const encryptedKey = await getEncryptedKey();
    if (!encryptedKey) {
      return { success: false, error: 'No encrypted key found' };
    }

    // Decrypt using NIP-49
    const privateKeyHex = decryptPrivateKeyNip49(encryptedKey, typedPin);
    const decryptedKey = privateKeyToKeyPair(privateKeyHex);
    
    // Try to decrypt mnemonic if available
    const encryptedMnemonic = await getEncryptedMnemonic();
    if (encryptedMnemonic) {
      try {
        decryptedKey.mnemonic = decryptMnemonicNip49(encryptedMnemonic, typedPin);
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
    const encryptedKey = await getEncryptedKey();
    if (!encryptedKey) {
      return { success: false, error: 'No encrypted key found' };
    }

    // Decrypt using NIP-49
    const privateKeyHex = decryptPrivateKeyNip49(encryptedKey, encryptionKeyData.key);
    const decryptedKey = privateKeyToKeyPair(privateKeyHex);
    
    // Try to decrypt mnemonic if available
    const encryptedMnemonic = await getEncryptedMnemonic();
    if (encryptedMnemonic) {
      try {
        decryptedKey.mnemonic = decryptMnemonicNip49(encryptedMnemonic, encryptionKeyData.key);
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
 * Fixed key for insecure storage - provides NO SECURITY
 * Anyone with access to the source code can decrypt the key
 */
const INSECURE_STORAGE_KEY = 'insecure-plebtap-key';

/**
 * Store key without authentication (insecure mode)
 * Uses NIP-49 encryption with minimal scrypt iterations
 * Provides no real security but maintains consistent storage format
 */
export async function storeInsecurely(
  privateKeyHex: PrivateKeyHex,
  publicKeyHex: PublicKeyHex,
  mnemonic?: Mnemonic
): Promise<{ success: boolean; error?: string }> {
  try {
    // Encrypt with NIP-49 using fixed key and fast logN (no real security)
    const ncryptsec = encryptPrivateKeyNip49(privateKeyHex, INSECURE_STORAGE_KEY, NIP49_FAST_LOGN) as Ncryptsec;
    
    // Store
    await storeEncryptedKey(ncryptsec, publicKeyHex);
    
    // Always encrypt and store mnemonic if provided
    if (mnemonic) {
      const ncryptmnem = encryptMnemonicNip49(mnemonic, INSECURE_STORAGE_KEY, NIP49_FAST_LOGN) as Ncryptmnem;
      await storeEncryptedMnemonic(ncryptmnem);
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
    const encryptedKey = await getEncryptedKey();
    if (!encryptedKey) {
      return { success: false, error: 'No encrypted key found' };
    }

    // Decrypt using NIP-49
    const privateKeyHex = decryptPrivateKeyNip49(encryptedKey, INSECURE_STORAGE_KEY);
    const decryptedKey = privateKeyToKeyPair(privateKeyHex);
    
    // Try to decrypt mnemonic if available
    const encryptedMnemonic = await getEncryptedMnemonic();
    if (encryptedMnemonic) {
      try {
        decryptedKey.mnemonic = decryptMnemonicNip49(encryptedMnemonic, INSECURE_STORAGE_KEY);
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
 * Export the mnemonic (requires unlock with PIN or WebAuthn)
 * @param pin - User's PIN for decryption (only for PIN auth)
 * @returns The mnemonic if successful
 */
export async function exportMnemonic(pin: string): Promise<{ success: boolean; mnemonic?: Mnemonic; error?: string }> {
  try {
    const encryptedMnemonic = await getEncryptedMnemonic();
    if (!encryptedMnemonic) {
      return { success: false, error: 'No mnemonic stored' };
    }

    let decryptionKey: string;
    
    // Determine the decryption key based on auth method
    if (securityState.authMethod === 'pin') {
      decryptionKey = pin;
    } else if (securityState.authMethod === 'webauthn') {
      const encryptionKeyData = await getWebAuthnEncryptionKey();
      if (!encryptionKeyData) {
        return { success: false, error: 'WebAuthn key not found' };
      }
      decryptionKey = encryptionKeyData.key;
    } else {
      // Insecure storage
      decryptionKey = INSECURE_STORAGE_KEY;
    }
    
    // Decrypt using NIP-49
    const mnemonic = decryptMnemonicNip49(encryptedMnemonic, decryptionKey);

    return { success: true, mnemonic };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export mnemonic',
    };
  }
}
