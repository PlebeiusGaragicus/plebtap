// src/lib/types/wallet.ts
// Type definitions for wallet-related operations

import type { GetInfoResponse, MintKeyset } from '@cashu/cashu-ts';

/**
 * Mint information response from Cashu mint
 */
export type MintInfo = GetInfoResponse;

/**
 * Map of mint keysets indexed by keyset ID
 */
export type MintKeysets = Map<string, MintKeyset>;

/**
 * Negentropy library types
 */
export interface NegentropyLibrary {
  Negentropy: new (storage: NegentropyStorageVector, frameSize: number) => NegentropyInstance;
  NegentropyStorageVector: new () => NegentropyStorageVector;
}

export interface NegentropyStorageVector {
  insert(timestamp: number, id: string): void;
  seal(): void;
}

export interface NegentropyInstance {
  initiate(): Uint8Array;
  reconcile(msg: Uint8Array): [Uint8Array | null, string[], string[]];
}

/**
 * Negentropy message types
 */
export type NegentropyMessage = [string, string, ...unknown[]];

/**
 * QR scanner result
 */
export interface QRScanResult {
  data: string;
  format?: string;
}

/**
 * UR (Uniform Resource) decoder interface
 */
export interface URDecoderInterface {
  receivePart(part: string): boolean;
  isComplete(): boolean;
  resultUR(): { cbor: Uint8Array };
  expectedPartCount(): number;
  receivedPartIndexes(): number[];
  estimatedPercentComplete(): number;
}

/**
 * UR encoder interface  
 */
export interface UREncoderInterface {
  nextPart(): string;
}
