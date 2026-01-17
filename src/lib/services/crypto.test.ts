// src/lib/services/crypto.test.ts
// Unit tests for the crypto service

import { describe, it, expect } from 'vitest';
import {
  generateMnemonic,
  validateMnemonic,
  getMnemonicWords,
  selectRandomWordIndices,
  mnemonicToPrivateKey,
  privateKeyToPublicKey,
  privateKeyToNsec,
  nsecToPrivateKey,
  publicKeyToNpub,
  npubToPublicKey,
  deriveKeyPair,
  privateKeyToKeyPair,
  nsecToKeyPair,
  hashPinForVerification,
  verifyPin,
  generateRandomPrivateKey,
  clearSensitiveData,
} from './crypto.js';
import {
  encryptPrivateKeyNip49,
  decryptPrivateKeyNip49,
  encryptMnemonicNip49,
  decryptMnemonicNip49,
  NIP49_DEFAULT_LOGN,
} from '$lib/utils/nip49.js';
import type { Mnemonic, Nsec, PrivateKeyHex, PIN } from '$lib/types/security.js';

// ============================================================================
// NIP-06 Test Vectors
// Source: https://github.com/nostr-protocol/nips/blob/master/06.md
// ============================================================================

const NIP06_TEST_VECTORS = [
  {
    mnemonic: 'leader monkey parrot ring guide accident before fence cannon height naive bean' as Mnemonic,
    privateKeyHex: '7f7ff03d123792d6ac594bfa67bf6d0c0ab55b6b1fdb6249303fe861f1ccba9a' as PrivateKeyHex,
    nsec: 'nsec10allq0gjx7fddtzef0ax00mdps9t2kmtrldkyjfs8l5xruwvh2dq0lhhkp' as Nsec,
  },
  {
    mnemonic: 'what bleak badge arrange retreat wolf trade produce cricket blur garlic valid proud rude strong choose busy staff weather area salt hollow arm fade' as Mnemonic,
    privateKeyHex: 'c15d739894c81a2fcfd3a2df85a0d2c0dbc47a280d092799f144d73d7ae78add' as PrivateKeyHex,
    nsec: 'nsec1c9wh8xy5eqdzln7n5t0ctgxjcrdug73gp5yj0x03gntn67h83twssdfhel' as Nsec,
  },
];

// ============================================================================
// Mnemonic Generation & Validation Tests
// ============================================================================

describe('Mnemonic Generation', () => {
  it('should generate a valid 24-word mnemonic (256-bit)', () => {
    const mnemonic = generateMnemonic(256);
    const words = getMnemonicWords(mnemonic);
    
    expect(words).toHaveLength(24);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('should generate a valid 12-word mnemonic (128-bit)', () => {
    const mnemonic = generateMnemonic(128);
    const words = getMnemonicWords(mnemonic);
    
    expect(words).toHaveLength(12);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('should generate unique mnemonics', () => {
    const mnemonic1 = generateMnemonic();
    const mnemonic2 = generateMnemonic();
    
    expect(mnemonic1).not.toBe(mnemonic2);
  });
});

describe('Mnemonic Validation', () => {
  it('should validate correct mnemonics', () => {
    for (const vector of NIP06_TEST_VECTORS) {
      expect(validateMnemonic(vector.mnemonic)).toBe(true);
    }
  });

  it('should reject invalid word count', () => {
    expect(validateMnemonic('abandon')).toBe(false);
    expect(validateMnemonic('abandon abandon abandon')).toBe(false);
  });

  it('should reject invalid checksum', () => {
    // Changed last word to break checksum
    const invalidMnemonic = 'leader monkey parrot ring guide accident before fence cannon height naive abandon';
    expect(validateMnemonic(invalidMnemonic)).toBe(false);
  });

  it('should reject invalid words', () => {
    const invalidMnemonic = 'leader monkey parrot ring guide accident before fence cannon height naive notaword';
    expect(validateMnemonic(invalidMnemonic)).toBe(false);
  });

  it('should handle case insensitivity', () => {
    const uppercase = 'LEADER MONKEY PARROT RING GUIDE ACCIDENT BEFORE FENCE CANNON HEIGHT NAIVE BEAN';
    expect(validateMnemonic(uppercase)).toBe(true);
  });

  it('should handle extra whitespace', () => {
    const spacey = '  leader   monkey  parrot ring  guide accident before fence cannon height naive bean  ';
    expect(validateMnemonic(spacey)).toBe(true);
  });
});

describe('getMnemonicWords', () => {
  it('should split mnemonic into words', () => {
    const words = getMnemonicWords(NIP06_TEST_VECTORS[0].mnemonic);
    expect(words).toEqual([
      'leader', 'monkey', 'parrot', 'ring', 'guide', 'accident',
      'before', 'fence', 'cannon', 'height', 'naive', 'bean'
    ]);
  });
});

describe('selectRandomWordIndices', () => {
  it('should select the correct number of indices', () => {
    const indices = selectRandomWordIndices(24, 3);
    expect(indices).toHaveLength(3);
  });

  it('should return sorted indices', () => {
    const indices = selectRandomWordIndices(24, 5);
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it('should return unique indices', () => {
    const indices = selectRandomWordIndices(24, 10);
    const unique = new Set(indices);
    expect(unique.size).toBe(indices.length);
  });

  it('should return valid indices within range', () => {
    const wordCount = 12;
    const indices = selectRandomWordIndices(wordCount, 5);
    for (const index of indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(wordCount);
    }
  });
});

// ============================================================================
// NIP-06 Key Derivation Tests
// ============================================================================

describe('NIP-06 Key Derivation', () => {
  it('should derive correct private key from mnemonic (12-word)', () => {
    const vector = NIP06_TEST_VECTORS[0];
    const privateKey = mnemonicToPrivateKey(vector.mnemonic);
    expect(privateKey).toBe(vector.privateKeyHex);
  });

  it('should derive correct private key from mnemonic (24-word)', () => {
    const vector = NIP06_TEST_VECTORS[1];
    const privateKey = mnemonicToPrivateKey(vector.mnemonic);
    expect(privateKey).toBe(vector.privateKeyHex);
  });

  it('should derive different keys with passphrase', () => {
    const mnemonic = NIP06_TEST_VECTORS[0].mnemonic;
    const keyWithoutPassphrase = mnemonicToPrivateKey(mnemonic, '');
    const keyWithPassphrase = mnemonicToPrivateKey(mnemonic, 'test passphrase');
    
    expect(keyWithoutPassphrase).not.toBe(keyWithPassphrase);
  });

  it('should derive different keys for different account indices', () => {
    const mnemonic = NIP06_TEST_VECTORS[0].mnemonic;
    const key0 = mnemonicToPrivateKey(mnemonic, '', 0);
    const key1 = mnemonicToPrivateKey(mnemonic, '', 1);
    
    expect(key0).not.toBe(key1);
  });
});

// ============================================================================
// Key Conversion Tests
// ============================================================================

describe('Key Conversions', () => {
  it('should convert private key to correct nsec', () => {
    for (const vector of NIP06_TEST_VECTORS) {
      const nsec = privateKeyToNsec(vector.privateKeyHex);
      expect(nsec).toBe(vector.nsec);
    }
  });

  it('should convert nsec back to private key', () => {
    for (const vector of NIP06_TEST_VECTORS) {
      const privateKey = nsecToPrivateKey(vector.nsec);
      expect(privateKey).toBe(vector.privateKeyHex);
    }
  });

  it('should derive public key from private key', () => {
    const privateKey = NIP06_TEST_VECTORS[0].privateKeyHex;
    const publicKey = privateKeyToPublicKey(privateKey);
    
    // Public key should be 64 hex characters (32 bytes)
    expect(publicKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should convert public key to npub and back', () => {
    const privateKey = NIP06_TEST_VECTORS[0].privateKeyHex;
    const publicKey = privateKeyToPublicKey(privateKey);
    const npub = publicKeyToNpub(publicKey);
    const recovered = npubToPublicKey(npub);
    
    expect(npub).toMatch(/^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/);
    expect(recovered).toBe(publicKey);
  });
});

describe('Key Pair Derivation', () => {
  it('should derive complete key pair from mnemonic', () => {
    const vector = NIP06_TEST_VECTORS[0];
    const keyPair = deriveKeyPair(vector.mnemonic);
    
    expect(keyPair.privateKeyHex).toBe(vector.privateKeyHex);
    expect(keyPair.nsec).toBe(vector.nsec);
    expect(keyPair.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(keyPair.npub).toMatch(/^npub1/);
  });

  it('should create key pair from private key hex', () => {
    const vector = NIP06_TEST_VECTORS[0];
    const keyPair = privateKeyToKeyPair(vector.privateKeyHex);
    
    expect(keyPair.privateKeyHex).toBe(vector.privateKeyHex);
    expect(keyPair.nsec).toBe(vector.nsec);
  });

  it('should create key pair from nsec', () => {
    const vector = NIP06_TEST_VECTORS[0];
    const keyPair = nsecToKeyPair(vector.nsec);
    
    expect(keyPair.privateKeyHex).toBe(vector.privateKeyHex);
    expect(keyPair.nsec).toBe(vector.nsec);
  });
});

// ============================================================================
// NIP-49 Encryption/Decryption Tests
// ============================================================================

describe('NIP-49 Private Key Encryption', () => {
  const testPrivateKey = NIP06_TEST_VECTORS[0].privateKeyHex;
  const testPassword = '123456';

  it('should encrypt and decrypt private key with correct password', () => {
    const encrypted = encryptPrivateKeyNip49(testPrivateKey, testPassword, NIP49_DEFAULT_LOGN);
    const decrypted = decryptPrivateKeyNip49(encrypted, testPassword);
    
    expect(decrypted).toBe(testPrivateKey);
  });

  it('should fail decryption with wrong password', () => {
    const encrypted = encryptPrivateKeyNip49(testPrivateKey, testPassword, NIP49_DEFAULT_LOGN);
    const wrongPassword = '654321';
    
    expect(() => decryptPrivateKeyNip49(encrypted, wrongPassword)).toThrow();
  });

  it('should produce different ciphertext for same key and password', () => {
    const encrypted1 = encryptPrivateKeyNip49(testPrivateKey, testPassword, NIP49_DEFAULT_LOGN);
    const encrypted2 = encryptPrivateKeyNip49(testPrivateKey, testPassword, NIP49_DEFAULT_LOGN);
    
    // Should be different due to random salt and nonce
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should produce ncryptsec1... format', () => {
    const encrypted = encryptPrivateKeyNip49(testPrivateKey, testPassword, NIP49_DEFAULT_LOGN);
    expect(encrypted).toMatch(/^ncryptsec1/);
  });
});

describe('NIP-49 Mnemonic Encryption', () => {
  const testMnemonic = NIP06_TEST_VECTORS[0].mnemonic;
  const testPassword = 'testpassword';

  it('should encrypt and decrypt mnemonic with correct password', () => {
    const encrypted = encryptMnemonicNip49(testMnemonic, testPassword, NIP49_DEFAULT_LOGN);
    const decrypted = decryptMnemonicNip49(encrypted, testPassword);
    
    expect(decrypted).toBe(testMnemonic);
  });

  it('should fail decryption with wrong password', () => {
    const encrypted = encryptMnemonicNip49(testMnemonic, testPassword, NIP49_DEFAULT_LOGN);
    const wrongPassword = 'wrongpassword';
    
    expect(() => decryptMnemonicNip49(encrypted, wrongPassword)).toThrow();
  });

  it('should produce ncryptmnem1... format', () => {
    const encrypted = encryptMnemonicNip49(testMnemonic, testPassword, NIP49_DEFAULT_LOGN);
    expect(encrypted).toMatch(/^ncryptmnem1/);
  });
});

// ============================================================================
// PIN Hash Tests
// ============================================================================

describe('PIN Hashing and Verification', () => {
  const testPIN = '123456' as PIN;

  it('should verify correct PIN', () => {
    const hash = hashPinForVerification(testPIN);
    expect(verifyPin(testPIN, hash)).toBe(true);
  });

  it('should reject incorrect PIN', () => {
    const hash = hashPinForVerification(testPIN);
    const wrongPIN = '654321' as PIN;
    expect(verifyPin(wrongPIN, hash)).toBe(false);
  });

  it('should produce different hashes for same PIN', () => {
    const hash1 = hashPinForVerification(testPIN);
    const hash2 = hashPinForVerification(testPIN);
    
    // Different salts should produce different hashes
    expect(hash1.salt).not.toBe(hash2.salt);
    expect(hash1.hash).not.toBe(hash2.hash);
  });

  it('should include correct metadata in hash', () => {
    const hash = hashPinForVerification(testPIN);
    
    expect(hash.algorithm).toBe('pbkdf2-sha256');
    expect(hash.iterations).toBeGreaterThan(0);
    expect(hash.salt).toBeTruthy();
    expect(hash.hash).toBeTruthy();
  });
});

// ============================================================================
// Utility Tests
// ============================================================================

describe('Utility Functions', () => {
  it('should generate random private key', () => {
    const key1 = generateRandomPrivateKey();
    const key2 = generateRandomPrivateKey();
    
    expect(key1).toMatch(/^[0-9a-f]{64}$/);
    expect(key2).toMatch(/^[0-9a-f]{64}$/);
    expect(key1).not.toBe(key2);
  });

  it('should clear sensitive data (best effort)', () => {
    const keyPair = deriveKeyPair(NIP06_TEST_VECTORS[0].mnemonic);
    const originalPrivateKey = keyPair.privateKeyHex;
    
    clearSensitiveData(keyPair);
    
    expect(keyPair.privateKeyHex).toBe('');
    expect(keyPair.nsec).toBe('');
    // Note: The original string still exists in memory, 
    // but the object reference is cleared
    expect(originalPrivateKey).not.toBe('');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty passphrase correctly', () => {
    const mnemonic = NIP06_TEST_VECTORS[0].mnemonic;
    const key1 = mnemonicToPrivateKey(mnemonic, '');
    const key2 = mnemonicToPrivateKey(mnemonic);
    
    expect(key1).toBe(key2);
  });

  it('should handle mnemonic with mixed case and extra spaces', () => {
    const messyMnemonic = '  Leader  MONKEY parrot  Ring guide ACCIDENT before fence cannon height naive bean  ' as Mnemonic;
    const cleanMnemonic = NIP06_TEST_VECTORS[0].mnemonic;
    
    // Validation should work
    expect(validateMnemonic(messyMnemonic)).toBe(true);
    
    // But derivation should produce the same key
    // Note: The derivation function normalizes the mnemonic internally
    const key1 = mnemonicToPrivateKey(messyMnemonic);
    const key2 = mnemonicToPrivateKey(cleanMnemonic);
    
    expect(key1).toBe(key2);
  });
});
