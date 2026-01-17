// src/lib/types/security.ts
// Branded types and interfaces for secure key management

/**
 * Branded type helper - creates nominal types that prevent accidental mixing
 */
declare const brand: unique symbol;
type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

// ============================================================================
// Branded Key Types
// ============================================================================

/**
 * Private key in hexadecimal format (64 characters)
 */
export type PrivateKeyHex = Brand<string, 'PrivateKeyHex'>;

/**
 * Public key in hexadecimal format (64 characters)
 */
export type PublicKeyHex = Brand<string, 'PublicKeyHex'>;

/**
 * Nostr secret key in bech32 format (nsec1...)
 */
export type Nsec = Brand<string, 'Nsec'>;

/**
 * Nostr public key in bech32 format (npub1...)
 */
export type Npub = Brand<string, 'Npub'>;

/**
 * BIP-39 mnemonic seed phrase (12 or 24 words)
 */
export type Mnemonic = Brand<string, 'Mnemonic'>;

/**
 * User-provided PIN for encryption (4-8 digits)
 */
export type PIN = Brand<string, 'PIN'>;

// ============================================================================
// Encrypted Storage Types
// ============================================================================

/**
 * KDF (Key Derivation Function) parameters
 */
export interface KDFParams {
  algorithm: 'pbkdf2' | 'scrypt';
  iterations: number;
  /** Memory cost in bytes (for scrypt) */
  memory?: number;
  /** Parallelism factor (for scrypt) */
  parallelism?: number;
}

/**
 * Encrypted private key blob for secure storage
 */
export interface EncryptedKeyBlob {
  /** Version identifier for future compatibility */
  version: 'plebtap-v1';
  /** Encryption algorithm used */
  algorithm: 'aes-256-gcm';
  /** Salt for key derivation (base64) */
  salt: string;
  /** Initialization vector (base64) */
  iv: string;
  /** Encrypted data (base64) */
  ciphertext: string;
  /** Key derivation parameters */
  kdfParams: KDFParams;
  /** Timestamp of encryption */
  createdAt: number;
}

/**
 * Decrypted key material (should be cleared from memory after use)
 */
export interface DecryptedKey {
  privateKeyHex: PrivateKeyHex;
  publicKeyHex: PublicKeyHex;
  npub: Npub;
  nsec: Nsec;
  /** Optional mnemonic if created from seed phrase */
  mnemonic?: Mnemonic;
}

/**
 * PIN hash for verification (not the PIN itself)
 */
export interface PINHash {
  /** Hashed PIN (base64) */
  hash: string;
  /** Salt used for hashing (base64) */
  salt: string;
  /** Algorithm used */
  algorithm: 'pbkdf2-sha256';
  /** Number of iterations */
  iterations: number;
}

// ============================================================================
// WebAuthn Types
// ============================================================================

/**
 * Stored WebAuthn credential information
 */
export interface StoredCredential {
  /** Credential ID (base64) */
  credentialId: string;
  /** Public key (base64) */
  publicKey: string;
  /** Counter for replay protection */
  counter: number;
  /** Timestamp of registration */
  registeredAt: number;
  /** Friendly name for the credential */
  name?: string;
}

/**
 * WebAuthn registration result
 */
export interface CredentialRegistration {
  credentialId: string;
  publicKey: string;
  counter: number;
}

/**
 * Authentication method chosen by user
 */
export type AuthMethod = 'pin' | 'webauthn' | 'none';

/**
 * PIN length options
 */
export type PinLength = 4 | 6;

/**
 * WebAuthn encryption key storage
 * When using WebAuthn-only auth, we encrypt the private key with a random key.
 * This random key is stored here and only accessible after WebAuthn verification.
 */
export interface WebAuthnEncryptionKey {
  /** Random encryption key (base64) - 256 bits */
  key: string;
  /** Timestamp of creation */
  createdAt: number;
}

// ============================================================================
// Security Preferences
// ============================================================================

/**
 * User's security preferences stored in secure storage
 */
export interface SecurityPreferences {
  /** Authentication method chosen by user: 'pin', 'webauthn', or 'none' (not set up) */
  authMethod: AuthMethod;
  /** PIN length if using PIN auth (4 or 6 digits) */
  pinLength: PinLength;
  /** Timestamp of last successful unlock */
  lastUnlockAt: number | null;
  /** Number of failed PIN attempts (for rate limiting) */
  failedPinAttempts: number;
  /** Timestamp of last failed attempt */
  lastFailedAttemptAt: number | null;
  /** Auto-lock after inactivity (opt-in, default false) */
  autoLockEnabled: boolean;
}

/**
 * Complete secure storage schema
 */
export interface SecureStorageSchema {
  /** Encrypted private key blob */
  encryptedKey: EncryptedKeyBlob | null;
  /** Encrypted mnemonic blob (optional, only if created from seed) */
  encryptedMnemonic: EncryptedMnemonicBlob | null;
  /** PIN verification hash (only for PIN auth) */
  pinHash: PINHash | null;
  /** WebAuthn credential (if using WebAuthn auth) */
  webauthnCredential: StoredCredential | null;
  /** WebAuthn encryption key (if using WebAuthn auth) */
  webauthnEncryptionKey: WebAuthnEncryptionKey | null;
  /** Security preferences */
  preferences: SecurityPreferences;
  /** User's public key (not sensitive, for identification) */
  publicKeyHex: PublicKeyHex | null;
  /** Schema version for migrations */
  schemaVersion: number;
}

/**
 * Encrypted mnemonic blob (imported from crypto.ts)
 * Re-declared here to avoid circular imports
 */
export interface EncryptedMnemonicBlob {
  version: 'plebtap-mnemonic-v1';
  algorithm: 'aes-256-gcm';
  salt: string;
  iv: string;
  ciphertext: string;
  kdfParams: KDFParams;
  createdAt: number;
}

// ============================================================================
// Security State (for Svelte stores)
// ============================================================================

/**
 * Current security state exposed to UI
 */
export interface SecurityState {
  /** Authentication method: 'pin', 'webauthn', or 'none' (not set up) */
  authMethod: AuthMethod;
  /** PIN length if using PIN auth */
  pinLength: PinLength;
  /** Whether WebAuthn is available on this device */
  webauthnAvailable: boolean;
  /** Whether there's a stored encrypted key that needs unlocking */
  hasStoredKey: boolean;
  /** Whether the key is currently unlocked in memory */
  isUnlocked: boolean;
  /** Timestamp when current unlock expires */
  unlockExpiresAt: number | null;
}

/**
 * Result of an unlock attempt
 */
export interface UnlockResult {
  success: boolean;
  error?: string;
  /** If successful, the decrypted key (should be used immediately and cleared) */
  key?: DecryptedKey;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Validates that a string is a valid nsec (Nostr secret key)
 */
export function isValidNsec(value: string): value is Nsec {
  if (!value || typeof value !== 'string') return false;
  // nsec1 + 58 characters of bech32
  return /^nsec1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(value);
}

/**
 * Validates that a string is a valid npub (Nostr public key)
 */
export function isValidNpub(value: string): value is Npub {
  if (!value || typeof value !== 'string') return false;
  // npub1 + 58 characters of bech32
  return /^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(value);
}

/**
 * Validates that a string is a valid hex private key
 */
export function isValidPrivateKeyHex(value: string): value is PrivateKeyHex {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{64}$/i.test(value);
}

/**
 * Validates that a string is a valid hex public key
 */
export function isValidPublicKeyHex(value: string): value is PublicKeyHex {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{64}$/i.test(value);
}

/**
 * Validates that a string is a valid BIP-39 mnemonic (basic format check)
 * Note: Full validation requires checking against wordlist and checksum
 */
export function isValidMnemonicFormat(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const words = value.trim().toLowerCase().split(/\s+/);
  // BIP-39 supports 12, 15, 18, 21, or 24 words
  return [12, 15, 18, 21, 24].includes(words.length);
}

/**
 * Validates that a string is a valid PIN format
 * @param value - The PIN to validate
 * @param expectedLength - Optional expected length (4 or 6). If not provided, accepts 4-8 digits.
 */
export function isValidPIN(value: string, expectedLength?: PinLength): value is PIN {
  if (!value || typeof value !== 'string') return false;
  if (expectedLength) {
    return new RegExp(`^\\d{${expectedLength}}$`).test(value);
  }
  // Default: PIN must be 4-8 digits
  return /^\d{4,8}$/.test(value);
}

/**
 * Validates an EncryptedKeyBlob structure
 */
export function isValidEncryptedKeyBlob(value: unknown): value is EncryptedKeyBlob {
  if (!value || typeof value !== 'object') return false;
  const blob = value as Record<string, unknown>;
  
  return (
    blob.version === 'plebtap-v1' &&
    blob.algorithm === 'aes-256-gcm' &&
    typeof blob.salt === 'string' &&
    typeof blob.iv === 'string' &&
    typeof blob.ciphertext === 'string' &&
    typeof blob.kdfParams === 'object' &&
    blob.kdfParams !== null &&
    typeof blob.createdAt === 'number'
  );
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default KDF parameters for PIN-based encryption
 * These provide a balance between security and performance
 */
export const DEFAULT_KDF_PARAMS: KDFParams = {
  algorithm: 'pbkdf2',
  iterations: 600000, // OWASP 2023 recommendation for PBKDF2-SHA256
};

/**
 * Scrypt parameters for higher security (when performance allows)
 */
export const SCRYPT_KDF_PARAMS: KDFParams = {
  algorithm: 'scrypt',
  iterations: 2 ** 14, // N = 16384
  memory: 8, // r = 8
  parallelism: 1, // p = 1
};

/**
 * Default security preferences for new accounts
 */
export const DEFAULT_SECURITY_PREFERENCES: SecurityPreferences = {
  authMethod: 'none',
  pinLength: 6,
  lastUnlockAt: null,
  failedPinAttempts: 0,
  lastFailedAttemptAt: null,
  autoLockEnabled: false,
};

/**
 * Current schema version for migrations
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Rate limiting constants for failed PIN attempts
 */
export const PIN_RATE_LIMIT = {
  /** Maximum failed attempts before lockout */
  maxAttempts: 5,
  /** Lockout duration in milliseconds (5 minutes) */
  lockoutDuration: 5 * 60 * 1000,
  /** Reset failed attempts after this duration (1 hour) */
  resetAfter: 60 * 60 * 1000,
};

/**
 * Unlock session duration in milliseconds (5 minutes)
 */
export const UNLOCK_SESSION_DURATION = 5 * 60 * 1000;
