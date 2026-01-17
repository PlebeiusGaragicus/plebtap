// src/lib/services/crypto.ts
// Cryptographic operations for secure key management
//
// This file contains:
// - Mnemonic generation and validation (BIP-39)
// - Key derivation (NIP-06)
// - Bech32 encoding/decoding (nsec/npub)
// - PIN hashing for verification
//
// For encryption, use NIP-49 functions from $lib/utils/nip49.js

import { generateMnemonic as bip39Generate, validateMnemonic as bip39Validate, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bech32 } from '@scure/base';
import { getPublicKey } from '@noble/secp256k1';

import type {
  Mnemonic,
  Nsec,
  Npub,
  PrivateKeyHex,
  PublicKeyHex,
  PIN,
  DecryptedKey,
  PINHash,
} from '$lib/types/security.js';
import { isValidPIN, isValidMnemonicFormat } from '$lib/types/security.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * NIP-06 derivation path for Nostr keys
 * m/44'/1237'/account'/0/0
 * - 44' = BIP-44 purpose
 * - 1237' = Nostr coin type (from SLIP-0044)
 * - account' = account index
 * - 0/0 = external chain, first key
 */
const NIP06_DERIVATION_PATH = "m/44'/1237'/0'/0/0";

/**
 * Bech32 prefixes for Nostr keys
 */
const NSEC_PREFIX = 'nsec';
const NPUB_PREFIX = 'npub';
const BECH32_LIMIT = 90;

// ============================================================================
// Mnemonic Generation & Validation
// ============================================================================

/**
 * Generate a new BIP-39 mnemonic seed phrase
 * @param strength - Bit strength (128 = 12 words, 256 = 24 words)
 * @returns A valid BIP-39 mnemonic
 */
export function generateMnemonic(strength: 128 | 256 = 256): Mnemonic {
  const mnemonic = bip39Generate(wordlist, strength);
  return mnemonic as Mnemonic;
}

/**
 * Validate a BIP-39 mnemonic seed phrase
 * @param mnemonic - The mnemonic to validate
 * @returns true if valid, false otherwise
 */
export function validateMnemonic(mnemonic: string): mnemonic is Mnemonic {
  // Normalize: trim, lowercase, collapse multiple spaces
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!isValidMnemonicFormat(normalized)) {
    return false;
  }
  return bip39Validate(normalized, wordlist);
}

/**
 * Get individual words from a mnemonic for verification
 * @param mnemonic - The mnemonic phrase
 * @returns Array of words
 */
export function getMnemonicWords(mnemonic: Mnemonic): string[] {
  return mnemonic.trim().toLowerCase().split(/\s+/);
}

/**
 * Select random word indices for verification
 * @param wordCount - Total number of words in mnemonic
 * @param selectCount - Number of indices to select
 * @returns Array of random indices (0-based)
 */
export function selectRandomWordIndices(wordCount: number, selectCount: number = 3): number[] {
  const indices: number[] = [];
  const available = Array.from({ length: wordCount }, (_, i) => i);
  
  for (let i = 0; i < Math.min(selectCount, wordCount); i++) {
    const randomIndex = Math.floor(Math.random() * available.length);
    indices.push(available[randomIndex]);
    available.splice(randomIndex, 1);
  }
  
  return indices.sort((a, b) => a - b);
}

// ============================================================================
// Key Derivation (NIP-06)
// ============================================================================

/**
 * Derive a Nostr private key from a BIP-39 mnemonic
 * Uses NIP-06 derivation path: m/44'/1237'/account'/0/0
 * 
 * @param mnemonic - BIP-39 mnemonic phrase
 * @param passphrase - Optional BIP-39 passphrase (default: empty)
 * @param accountIndex - Account index for derivation (default: 0)
 * @returns The derived private key in hex format
 */
export function mnemonicToPrivateKey(
  mnemonic: Mnemonic,
  passphrase: string = '',
  accountIndex: number = 0
): PrivateKeyHex {
  // Normalize mnemonic: trim, lowercase, collapse spaces
  const normalizedMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Convert mnemonic to seed using BIP-39
  const seed = mnemonicToSeedSync(normalizedMnemonic, passphrase);
  
  // Create HD key from seed
  const hdKey = HDKey.fromMasterSeed(seed);
  
  // Derive path with account index
  const path = `m/44'/1237'/${accountIndex}'/0/0`;
  const derived = hdKey.derive(path);
  
  if (!derived.privateKey) {
    throw new Error('Failed to derive private key');
  }
  
  return bytesToHex(derived.privateKey) as PrivateKeyHex;
}

/**
 * Derive public key from private key
 * @param privateKeyHex - Private key in hex format
 * @returns Public key in hex format
 */
export function privateKeyToPublicKey(privateKeyHex: PrivateKeyHex): PublicKeyHex {
  const privateKeyBytes = hexToBytes(privateKeyHex);
  const publicKeyBytes = getPublicKey(privateKeyBytes, true);
  // Remove the prefix byte (02 or 03) to get x-coordinate only
  const xOnlyPubKey = publicKeyBytes.slice(1);
  return bytesToHex(xOnlyPubKey) as PublicKeyHex;
}

// ============================================================================
// Bech32 Encoding/Decoding (nsec/npub)
// ============================================================================

/**
 * Convert private key hex to nsec format
 * @param privateKeyHex - Private key in hex format
 * @returns Private key in nsec format
 */
export function privateKeyToNsec(privateKeyHex: PrivateKeyHex): Nsec {
  const bytes = hexToBytes(privateKeyHex);
  const words = bech32.toWords(bytes);
  return bech32.encode(NSEC_PREFIX, words, BECH32_LIMIT) as Nsec;
}

/**
 * Convert nsec to private key hex
 * @param nsec - Private key in nsec format
 * @returns Private key in hex format
 */
export function nsecToPrivateKey(nsec: Nsec): PrivateKeyHex {
  const decoded = bech32.decode(nsec as `${string}1${string}`, BECH32_LIMIT);
  if (decoded.prefix !== NSEC_PREFIX) {
    throw new Error(`Invalid nsec prefix: ${decoded.prefix}`);
  }
  const bytes = new Uint8Array(bech32.fromWords(decoded.words));
  return bytesToHex(bytes) as PrivateKeyHex;
}

/**
 * Convert public key hex to npub format
 * @param publicKeyHex - Public key in hex format
 * @returns Public key in npub format
 */
export function publicKeyToNpub(publicKeyHex: PublicKeyHex): Npub {
  const bytes = hexToBytes(publicKeyHex);
  const words = bech32.toWords(bytes);
  return bech32.encode(NPUB_PREFIX, words, BECH32_LIMIT) as Npub;
}

/**
 * Convert npub to public key hex
 * @param npub - Public key in npub format
 * @returns Public key in hex format
 */
export function npubToPublicKey(npub: Npub): PublicKeyHex {
  const decoded = bech32.decode(npub as `${string}1${string}`, BECH32_LIMIT);
  if (decoded.prefix !== NPUB_PREFIX) {
    throw new Error(`Invalid npub prefix: ${decoded.prefix}`);
  }
  const bytes = new Uint8Array(bech32.fromWords(decoded.words));
  return bytesToHex(bytes) as PublicKeyHex;
}

// ============================================================================
// Complete Key Derivation
// ============================================================================

/**
 * Derive a complete key pair from a mnemonic
 * @param mnemonic - BIP-39 mnemonic phrase
 * @param passphrase - Optional BIP-39 passphrase
 * @param accountIndex - Account index for derivation
 * @returns Complete decrypted key object
 */
export function deriveKeyPair(
  mnemonic: Mnemonic,
  passphrase: string = '',
  accountIndex: number = 0
): DecryptedKey {
  const privateKeyHex = mnemonicToPrivateKey(mnemonic, passphrase, accountIndex);
  const publicKeyHex = privateKeyToPublicKey(privateKeyHex);
  const nsec = privateKeyToNsec(privateKeyHex);
  const npub = publicKeyToNpub(publicKeyHex);
  
  return {
    privateKeyHex,
    publicKeyHex,
    nsec,
    npub,
  };
}

/**
 * Create DecryptedKey from a private key hex
 * @param privateKeyHex - Private key in hex format
 * @returns Complete decrypted key object
 */
export function privateKeyToKeyPair(privateKeyHex: PrivateKeyHex): DecryptedKey {
  const publicKeyHex = privateKeyToPublicKey(privateKeyHex);
  const nsec = privateKeyToNsec(privateKeyHex);
  const npub = publicKeyToNpub(publicKeyHex);
  
  return {
    privateKeyHex,
    publicKeyHex,
    nsec,
    npub,
  };
}

/**
 * Create DecryptedKey from an nsec
 * @param nsec - Private key in nsec format
 * @returns Complete decrypted key object
 */
export function nsecToKeyPair(nsec: Nsec): DecryptedKey {
  const privateKeyHex = nsecToPrivateKey(nsec);
  return privateKeyToKeyPair(privateKeyHex);
}

// ============================================================================
// PIN Hash for Verification
// ============================================================================

/**
 * Create a hash of the PIN for verification
 * This is stored to verify PIN without storing the PIN itself
 * 
 * @param pin - User's PIN
 * @returns PIN hash object for storage
 */
export function hashPinForVerification(pin: PIN): PINHash {
  const salt = randomBytes(32);
  const iterations = 100000; // Lower than encryption since this is just for verification
  
  const normalizedPin = pin.normalize('NFKC');
  const hash = pbkdf2(sha256, normalizedPin, salt, {
    c: iterations,
    dkLen: 32,
  });
  
  return {
    hash: bytesToBase64(hash),
    salt: bytesToBase64(salt),
    algorithm: 'pbkdf2-sha256',
    iterations,
  };
}

/**
 * Verify a PIN against a stored hash
 * @param pin - PIN to verify
 * @param storedHash - Stored PIN hash
 * @returns true if PIN is correct
 */
export function verifyPin(pin: PIN, storedHash: PINHash): boolean {
  const salt = base64ToBytes(storedHash.salt);
  const normalizedPin = pin.normalize('NFKC');
  
  const computed = pbkdf2(sha256, normalizedPin, salt, {
    c: storedHash.iterations,
    dkLen: 32,
  });
  
  const stored = base64ToBytes(storedHash.hash);
  
  // Constant-time comparison
  return timingSafeEqual(computed, stored);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert bytes to base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Convert base64 string to bytes
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Constant-time comparison to prevent timing attacks
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  
  return result === 0;
}

/**
 * Generate a random private key (not from mnemonic)
 * @returns A new random private key
 */
export function generateRandomPrivateKey(): PrivateKeyHex {
  const privateKeyBytes = randomBytes(32);
  return bytesToHex(privateKeyBytes) as PrivateKeyHex;
}

/**
 * Clear sensitive data from memory (best effort)
 * Note: JavaScript doesn't guarantee memory clearing
 * @param data - Object containing sensitive data
 */
export function clearSensitiveData(data: DecryptedKey): void {
  // Overwrite string values with empty strings
  // Note: This is best-effort, as JavaScript strings are immutable
  (data as unknown as Record<string, string>).privateKeyHex = '';
  (data as unknown as Record<string, string>).nsec = '';
}
