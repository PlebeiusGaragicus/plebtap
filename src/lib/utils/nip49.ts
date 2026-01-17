// src/lib/utils/nip49.ts
// NIP-49 encrypted private key format (ncryptsec) and extended encryption utilities
// Uses scrypt KDF + XChaCha20-Poly1305 authenticated encryption

import { scrypt } from '@noble/hashes/scrypt.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { concatBytes, randomBytes, hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { bech32 } from '@scure/base';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import type { PrivateKeyHex, Mnemonic } from '$lib/types/security.js';

// Maximum size for bech32 encoding
const Bech32MaxSize = 5000;

// Bech32 prefixes
const NCRYPTSEC_PREFIX = 'ncryptsec';
const NCRYPTMNEM_PREFIX = 'ncryptmnem';

// Default scrypt parameters
export const NIP49_DEFAULT_LOGN = 16; // ~64MB memory, good security/performance balance
export const NIP49_FAST_LOGN = 1; // Minimal security for insecure mode (2^1 = 2 iterations)

/**
 * Encode bytes using bech32 encoding with a specific prefix
 */
function encodeBech32(prefix: string, data: Uint8Array): string {
	const words = bech32.toWords(data);
	return bech32.encode(prefix, words, Bech32MaxSize);
}

/**
 * Encrypt a private key using a password
 *
 * @param privateKey - The private key to encrypt as Uint8Array
 * @param password - The password to use for encryption
 * @param logn - Scrypt difficulty parameter (default: 16)
 * @param ksb - Key security byte (default: 0x02)
 * @returns - Encrypted key as a bech32-encoded string with 'ncryptsec' prefix
 */
export function encrypt(
	privateKey: Uint8Array,
	password: string,
	logn: number = 16,
	ksb: 0x00 | 0x01 | 0x02 = 0x02
): string {
	const salt = randomBytes(16);
	const n = 2 ** logn;
	const key = scrypt(password.normalize('NFKC'), salt, { N: n, r: 8, p: 1, dkLen: 32 });
	const nonce = randomBytes(24);
	const aad = Uint8Array.from([ksb]);
	const cipher = xchacha20poly1305(key, nonce, aad);
	const ciphertext = cipher.encrypt(privateKey);

	// Combine all components into a single byte array
	const combinedBytes = concatBytes(
		Uint8Array.from([0x02]), // Version
		Uint8Array.from([logn]), // Difficulty parameter
		salt,
		nonce,
		aad,
		ciphertext
	);

	// Encode as bech32 with 'ncryptsec' prefix
	return encodeBech32('ncryptsec', combinedBytes);
}

/**
 * Decrypt an encrypted private key
 *
 * @param encryptedKey - The encrypted key as a bech32-encoded string
 * @param password - The password used for encryption
 * @returns - Decrypted private key as Uint8Array
 */
export function decrypt(encryptedKey: string, password: string): Uint8Array {
	// Decode the bech32 string
	const { prefix, words } = bech32.decode(encryptedKey as `${string}1${string}`, Bech32MaxSize);

	if (prefix !== 'ncryptsec') {
		throw new Error(`Invalid prefix ${prefix}, expected 'ncryptsec'`);
	}

	const bytes = new Uint8Array(bech32.fromWords(words));

	// Check version
	const version = bytes[0];
	if (version !== 0x02) {
		throw new Error(`Invalid version ${version}, expected 0x02`);
	}

	// Extract components
	const logn = bytes[1];
	const n = 2 ** logn;

	const salt = bytes.slice(2, 2 + 16);
	const nonce = bytes.slice(2 + 16, 2 + 16 + 24);
	const ksb = bytes[2 + 16 + 24];
	const aad = Uint8Array.from([ksb]);
	const ciphertext = bytes.slice(2 + 16 + 24 + 1);

	// Derive key and decrypt
	const key = scrypt(password.normalize('NFKC'), salt, { N: n, r: 8, p: 1, dkLen: 32 });
	const cipher = xchacha20poly1305(key, nonce, aad);

	return cipher.decrypt(ciphertext);
}

/**
 * Encrypt an NDKPrivateKeySigner with a password, returning a NIP-49 encrypted string
 */
export function encryptSigner(signer: NDKPrivateKeySigner, password: string): string {
	if (!signer.privateKey) {
		throw new Error('Signer does not have a private key');
	}

	const privateKeyBytes = hexToBytes(signer.privateKey);
	return encrypt(privateKeyBytes, password);
}

/**
 * Create an NDKPrivateKeySigner from a NIP-49 encrypted key
 */
export function decryptToSigner(encryptedKey: string, password: string): NDKPrivateKeySigner {
	const privateKeyBytes = decrypt(encryptedKey, password);
	const privateKeyHex = bytesToHex(privateKeyBytes);
	return new NDKPrivateKeySigner(privateKeyHex);
}

// ============================================================================
// Private Key Hex Helpers
// ============================================================================

/**
 * Encrypt a private key hex string to NIP-49 ncryptsec format
 *
 * @param privateKeyHex - The private key in hex format (64 characters)
 * @param password - The password to use for encryption
 * @param logn - Scrypt difficulty parameter (default: 16)
 * @returns - Encrypted key as ncryptsec1... string
 */
export function encryptPrivateKeyNip49(
	privateKeyHex: PrivateKeyHex,
	password: string,
	logn: number = NIP49_DEFAULT_LOGN
): string {
	const privateKeyBytes = hexToBytes(privateKeyHex);
	return encrypt(privateKeyBytes, password, logn);
}

/**
 * Decrypt an ncryptsec string to private key hex
 *
 * @param ncryptsec - The encrypted key as ncryptsec1... string
 * @param password - The password used for encryption
 * @returns - Decrypted private key in hex format
 */
export function decryptPrivateKeyNip49(ncryptsec: string, password: string): PrivateKeyHex {
	const privateKeyBytes = decrypt(ncryptsec, password);
	return bytesToHex(privateKeyBytes) as PrivateKeyHex;
}

// ============================================================================
// Mnemonic Encryption (NIP-49 style with ncryptmnem prefix)
// ============================================================================

/**
 * Encrypt a mnemonic using NIP-49 style encryption
 * Uses the same scrypt + XChaCha20-Poly1305 scheme but with 'ncryptmnem' prefix
 *
 * @param mnemonic - The BIP-39 mnemonic seed phrase
 * @param password - The password to use for encryption
 * @param logn - Scrypt difficulty parameter (default: 16)
 * @returns - Encrypted mnemonic as ncryptmnem1... string
 */
export function encryptMnemonicNip49(
	mnemonic: Mnemonic,
	password: string,
	logn: number = NIP49_DEFAULT_LOGN
): string {
	const mnemonicBytes = new TextEncoder().encode(mnemonic);
	const salt = randomBytes(16);
	const n = 2 ** logn;
	const key = scrypt(password.normalize('NFKC'), salt, { N: n, r: 8, p: 1, dkLen: 32 });
	const nonce = randomBytes(24);
	// Use 0x00 as ksb for mnemonic (no special security flags needed)
	const aad = Uint8Array.from([0x00]);
	const cipher = xchacha20poly1305(key, nonce, aad);
	const ciphertext = cipher.encrypt(mnemonicBytes);

	// Combine all components into a single byte array
	const combinedBytes = concatBytes(
		Uint8Array.from([0x02]), // Version
		Uint8Array.from([logn]), // Difficulty parameter
		salt,
		nonce,
		aad,
		ciphertext
	);

	// Encode as bech32 with 'ncryptmnem' prefix
	return encodeBech32(NCRYPTMNEM_PREFIX, combinedBytes);
}

/**
 * Decrypt an encrypted mnemonic
 *
 * @param encryptedMnemonic - The encrypted mnemonic as ncryptmnem1... string
 * @param password - The password used for encryption
 * @returns - Decrypted mnemonic
 */
export function decryptMnemonicNip49(encryptedMnemonic: string, password: string): Mnemonic {
	// Decode the bech32 string
	const { prefix, words } = bech32.decode(encryptedMnemonic as `${string}1${string}`, Bech32MaxSize);

	if (prefix !== NCRYPTMNEM_PREFIX) {
		throw new Error(`Invalid prefix ${prefix}, expected '${NCRYPTMNEM_PREFIX}'`);
	}

	const bytes = new Uint8Array(bech32.fromWords(words));

	// Check version
	const version = bytes[0];
	if (version !== 0x02) {
		throw new Error(`Invalid version ${version}, expected 0x02`);
	}

	// Extract components
	const logn = bytes[1];
	const n = 2 ** logn;

	const salt = bytes.slice(2, 2 + 16);
	const nonce = bytes.slice(2 + 16, 2 + 16 + 24);
	const ksb = bytes[2 + 16 + 24];
	const aad = Uint8Array.from([ksb]);
	const ciphertext = bytes.slice(2 + 16 + 24 + 1);

	// Derive key and decrypt
	const key = scrypt(password.normalize('NFKC'), salt, { N: n, r: 8, p: 1, dkLen: 32 });
	const cipher = xchacha20poly1305(key, nonce, aad);

	const mnemonicBytes = cipher.decrypt(ciphertext);
	return new TextDecoder().decode(mnemonicBytes) as Mnemonic;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a string is a valid ncryptsec encrypted key
 */
export function isValidNcryptsec(value: string): boolean {
	if (!value || typeof value !== 'string') return false;
	try {
		const { prefix } = bech32.decode(value as `${string}1${string}`, Bech32MaxSize);
		return prefix === NCRYPTSEC_PREFIX;
	} catch {
		return false;
	}
}

/**
 * Check if a string is a valid ncryptmnem encrypted mnemonic
 */
export function isValidNcryptmnem(value: string): boolean {
	if (!value || typeof value !== 'string') return false;
	try {
		const { prefix } = bech32.decode(value as `${string}1${string}`, Bech32MaxSize);
		return prefix === NCRYPTMNEM_PREFIX;
	} catch {
		return false;
	}
}

/**
 * Get the logn (difficulty) parameter from an encrypted string
 * Useful for determining if re-encryption with stronger parameters is needed
 */
export function getEncryptedLogn(encrypted: string): number {
	const { words } = bech32.decode(encrypted as `${string}1${string}`, Bech32MaxSize);
	const bytes = new Uint8Array(bech32.fromWords(words));
	return bytes[1];
}
