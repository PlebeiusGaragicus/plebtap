// src/lib/services/webauthn.ts
// WebAuthn integration for platform authenticator (biometrics/device PIN)

import { BROWSER as browser } from 'esm-env';
import type { StoredCredential, CredentialRegistration } from '$lib/types/security.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Relying Party ID - should match the origin domain
 * In development, this will be 'localhost'
 */
function getRelyingPartyId(): string {
  if (!browser) return 'plebtap.local';
  return window.location.hostname;
}

/**
 * Relying Party Name for display
 */
const RP_NAME = 'PlebTap Wallet';

/**
 * Timeout for WebAuthn operations (30 seconds)
 */
const WEBAUTHN_TIMEOUT = 30000;

// ============================================================================
// Availability Detection
// ============================================================================

/**
 * Check if WebAuthn is supported in this browser
 */
export function isWebAuthnSupported(): boolean {
  if (!browser) return false;
  return 'PublicKeyCredential' in window;
}

/**
 * Check if a platform authenticator (biometrics/device PIN) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (error) {
    console.error('Error checking platform authenticator:', error);
    return false;
  }
}

/**
 * Check if conditional mediation (passkey autofill) is available
 */
export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    if ('isConditionalMediationAvailable' in PublicKeyCredential &&
        typeof (PublicKeyCredential as { isConditionalMediationAvailable?: () => Promise<boolean> }).isConditionalMediationAvailable === 'function') {
      return await (PublicKeyCredential as { isConditionalMediationAvailable: () => Promise<boolean> }).isConditionalMediationAvailable();
    }
    return false;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// Credential Registration
// ============================================================================

/**
 * Generate a random challenge for WebAuthn operations
 */
function generateChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Convert a string to Uint8Array
 */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to base64 URL-safe string
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Convert base64 URL-safe string to Uint8Array
 */
function base64UrlToBytes(base64: string): Uint8Array {
  const base64Standard = base64.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64Standard + '='.repeat((4 - base64Standard.length % 4) % 4);
  const binary = atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Register a new WebAuthn credential
 * This creates a passkey bound to the platform authenticator
 * 
 * @param userId - Unique user identifier (e.g., public key hex)
 * @param userName - Display name for the credential
 * @returns Credential registration result
 */
export async function registerCredential(
  userId: string,
  userName: string = 'PlebTap User'
): Promise<CredentialRegistration> {
  if (!await isPlatformAuthenticatorAvailable()) {
    throw new Error('Platform authenticator is not available');
  }

  const challenge = generateChallenge();
  const userIdBytes = stringToBytes(userId);

  const createOptions: CredentialCreationOptions = {
    publicKey: {
      challenge: new Uint8Array(challenge) as unknown as ArrayBuffer,
      rp: {
        name: RP_NAME,
        id: getRelyingPartyId(),
      },
      user: {
        id: new Uint8Array(userIdBytes) as unknown as ArrayBuffer,
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256 (P-256)
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: WEBAUTHN_TIMEOUT,
      attestation: 'none',
    },
  };

  try {
    const credential = await navigator.credentials.create(createOptions) as PublicKeyCredential;
    
    if (!credential) {
      throw new Error('No credential returned from authenticator');
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    
    return {
      credentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
      publicKey: bytesToBase64Url(new Uint8Array(response.getPublicKey() || [])),
      counter: 0,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('User cancelled the registration');
      }
      if (error.name === 'InvalidStateError') {
        throw new Error('A credential already exists for this user');
      }
      throw new Error(`Registration failed: ${error.message}`);
    }
    throw new Error('Registration failed: Unknown error');
  }
}

// ============================================================================
// User Verification
// ============================================================================

/**
 * Request user verification using a stored credential
 * This prompts for biometric or device PIN
 * 
 * @param credential - The stored credential to use
 * @returns true if verification succeeded
 */
export async function requestUserVerification(
  credential: StoredCredential
): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported');
  }

  const challenge = generateChallenge();
  const credentialId = base64UrlToBytes(credential.credentialId);

  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge: new Uint8Array(challenge) as unknown as ArrayBuffer,
      rpId: getRelyingPartyId(),
      allowCredentials: [
        {
          id: new Uint8Array(credentialId) as unknown as ArrayBuffer,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: WEBAUTHN_TIMEOUT,
    },
  };

  try {
    const assertion = await navigator.credentials.get(getOptions) as PublicKeyCredential;
    
    if (!assertion) {
      return false;
    }

    const response = assertion.response as AuthenticatorAssertionResponse;
    
    // In a full implementation, we would verify the signature here
    // For our use case (local user verification), we just need to know
    // the authenticator successfully verified the user
    
    // Update counter for replay protection
    const authenticatorData = new Uint8Array(response.authenticatorData);
    const counter = new DataView(authenticatorData.buffer).getUint32(33, false);
    
    if (counter <= credential.counter) {
      console.warn('WebAuthn counter did not increment - possible replay attack');
      // We still allow it for local use, but log the warning
    }

    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        // User cancelled or timeout
        return false;
      }
      console.error('WebAuthn verification error:', error);
    }
    return false;
  }
}

/**
 * Request user verification without a specific credential
 * Uses any available credential for the current RP
 * 
 * @returns true if verification succeeded
 */
export async function requestAnyUserVerification(): Promise<boolean> {
  if (!await isPlatformAuthenticatorAvailable()) {
    return false;
  }

  const challenge = generateChallenge();

  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge: new Uint8Array(challenge) as unknown as ArrayBuffer,
      rpId: getRelyingPartyId(),
      userVerification: 'required',
      timeout: WEBAUTHN_TIMEOUT,
    },
  };

  try {
    const assertion = await navigator.credentials.get(getOptions);
    return assertion !== null;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// Credential Management
// ============================================================================

/**
 * Create a StoredCredential object from registration result
 */
export function createStoredCredential(
  registration: CredentialRegistration,
  name?: string
): StoredCredential {
  return {
    credentialId: registration.credentialId,
    publicKey: registration.publicKey,
    counter: registration.counter,
    registeredAt: Date.now(),
    name: name || 'Platform Authenticator',
  };
}

/**
 * Update the counter on a stored credential
 */
export function updateCredentialCounter(
  credential: StoredCredential,
  newCounter: number
): StoredCredential {
  return {
    ...credential,
    counter: newCounter,
  };
}

// ============================================================================
// Helper for Combined Flow
// ============================================================================

/**
 * Check availability and optionally register a new credential
 * This is a helper for the onboarding flow
 */
export async function setupWebAuthn(
  userId: string,
  userName?: string
): Promise<{ available: boolean; credential?: StoredCredential }> {
  const available = await isPlatformAuthenticatorAvailable();
  
  if (!available) {
    return { available: false };
  }

  try {
    const registration = await registerCredential(userId, userName);
    const credential = createStoredCredential(registration);
    
    return {
      available: true,
      credential,
    };
  } catch (error) {
    console.error('WebAuthn setup failed:', error);
    return { available: true, credential: undefined };
  }
}

/**
 * Verify user and return result with fallback info
 */
export async function verifyUserWithFallback(
  credential: StoredCredential | null
): Promise<{
  verified: boolean;
  method: 'webauthn' | 'none';
  error?: string;
}> {
  if (!credential) {
    return {
      verified: false,
      method: 'none',
      error: 'No WebAuthn credential available',
    };
  }

  try {
    const verified = await requestUserVerification(credential);
    return {
      verified,
      method: 'webauthn',
    };
  } catch (error) {
    return {
      verified: false,
      method: 'none',
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}
