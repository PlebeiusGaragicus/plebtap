<!-- src/lib/components/plebtap/settings/nostr-keys.svelte -->
<script lang="ts">
	import { currentUser, ndkInstance } from '$lib/stores/nostr.js';
	import { copyToClipboard } from '$lib/utils/clipboard.js';
	import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js';
	import {
		AccordionItem,
		AccordionContent,
		AccordionTrigger
	} from '$lib/components/ui/accordion/index.js';
	import Copy from '@lucide/svelte/icons/copy';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Key from '@lucide/svelte/icons/key';
	import Lock from '@lucide/svelte/icons/lock';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Button from '$lib/components/ui/button/button.svelte';

	import {
		securityState,
		canPerformSensitiveOperation,
		hasAuthSetup,
		unlockWithPIN,
		unlockWithWebAuthn,
		lockSession,
		getUnlockedKey,
		hasMnemonicStored
	} from '$lib/stores/security.svelte.js';
	import KeySquare from '@lucide/svelte/icons/key-square';
	import { UnlockDialog, SecurityWarningDialog, AuthSetupDialog } from '$lib/components/plebtap/dialogs/index.js';
	import type { PrivateKeyHex, PublicKeyHex } from '$lib/types/security.js';
	import { privateKeyToNsec, privateKeyToPublicKey, publicKeyToNpub } from '$lib/services/crypto.js';

	let showPrivateKey = $state(false);
	let privateKey = $state('');
	let npub = $state('');
	let hasNdkPrivateKey = $state(false);
	
	// Mnemonic state
	let showMnemonic = $state(false);
	let mnemonic = $state('');
	let hasMnemonic = $state(false);

	// Dialog states
	let showUnlockDialog = $state(false);
	let showSecurityWarning = $state(false);
	let showAuthSetup = $state(false);
	let pendingAction = $state<'view' | 'copy' | 'view-mnemonic' | 'copy-mnemonic' | null>(null);

	// Get key pair from unlocked session (for PIN setup)
	let derivedPrivateKey = $state<PrivateKeyHex | null>(null);
	let derivedPublicKey = $state<PublicKeyHex | null>(null);

	// Fetch the pubkey from current user
	$effect(() => {
		if ($currentUser) {
			npub = $currentUser.npub || '';
		}
	});

	// Get private key from NDK signer if available
	$effect(() => {
		if ($ndkInstance && $ndkInstance.signer && 'privateKey' in $ndkInstance.signer) {
			const key = ($ndkInstance.signer as { privateKey?: string }).privateKey;
			hasNdkPrivateKey = !!key;
			// Don't store the actual private key directly - require unlock
			if (key && securityState.isUnlocked) {
				privateKey = key;
			}
		}
	});
	
	// Check if mnemonic is stored
	$effect(() => {
		hasMnemonicStored().then((has) => {
			hasMnemonic = has;
		});
	});

	// Update private key and mnemonic display when session unlocks
	$effect(() => {
		if (securityState.isUnlocked) {
			const unlockedKey = getUnlockedKey();
			if (unlockedKey) {
				privateKey = unlockedKey.nsec;
				if (unlockedKey.mnemonic) {
					mnemonic = unlockedKey.mnemonic;
				}
			}
		} else {
			// Hide when locked
			privateKey = '';
			mnemonic = '';
			showPrivateKey = false;
			showMnemonic = false;
		}
	});

	function requestViewPrivateKey() {
		pendingAction = 'view';
		performSecureAction();
	}

	function requestCopyPrivateKey() {
		pendingAction = 'copy';
		performSecureAction();
	}
	
	function requestViewMnemonic() {
		pendingAction = 'view-mnemonic';
		performSecureAction();
	}
	
	function requestCopyMnemonic() {
		pendingAction = 'copy-mnemonic';
		performSecureAction();
	}

	function performSecureAction() {
		// If no security is set up, show warning
		if (!hasAuthSetup()) {
			// If they have a private key in NDK but no auth, show warning
			if (hasNdkPrivateKey) {
				showSecurityWarning = true;
			}
			return;
		}

		// If already unlocked, perform action directly
		if (canPerformSensitiveOperation()) {
			executeAction();
			return;
		}

		// Show unlock dialog
		showUnlockDialog = true;
	}

	function executeAction() {
		if (pendingAction === 'view') {
			showPrivateKey = !showPrivateKey;
		} else if (pendingAction === 'copy') {
			if (privateKey) {
				copyToClipboard(privateKey, 'Private key');
			}
		} else if (pendingAction === 'view-mnemonic') {
			showMnemonic = !showMnemonic;
		} else if (pendingAction === 'copy-mnemonic') {
			if (mnemonic) {
				copyToClipboard(mnemonic, 'Seed phrase');
			}
		}
		pendingAction = null;
	}

	function handleUnlockSuccess() {
		// Update private key and mnemonic from unlocked session
		const unlockedKey = getUnlockedKey();
		if (unlockedKey) {
			privateKey = unlockedKey.nsec;
			if (unlockedKey.mnemonic) {
				mnemonic = unlockedKey.mnemonic;
			}
		}
		executeAction();
	}

	function handleSecurityWarningProceed() {
		// User accepted the risk, show the key from NDK directly
		if ($ndkInstance && $ndkInstance.signer && 'privateKey' in $ndkInstance.signer) {
			const key = ($ndkInstance.signer as { privateKey?: string }).privateKey;
			if (key) {
				privateKey = key;
				executeAction();
			}
		}
	}

	async function handleSetupAuth() {
		// For insecure storage, we need to get the key from unlocked session
		if (securityState.hasStoredKey && securityState.authMethod === 'none') {
			const { unlockInsecure } = await import('$lib/stores/security.svelte.js');
			const result = await unlockInsecure();
			if (result.success && result.key) {
				derivedPrivateKey = result.key.privateKeyHex;
				derivedPublicKey = result.key.publicKeyHex;
				showAuthSetup = true;
				return;
			}
		}
		
		// Otherwise, get the current key from NDK signer
		if ($ndkInstance && $ndkInstance.signer && 'privateKey' in $ndkInstance.signer) {
			const key = ($ndkInstance.signer as { privateKey?: string }).privateKey;
			if (key) {
				try {
					// The key from NDK is likely nsec or hex - convert to hex if needed
					const { nsecToPrivateKey, privateKeyToPublicKey } = await import('$lib/services/crypto.js');
					let hexKey: PrivateKeyHex;
					
					if (key.startsWith('nsec1')) {
						hexKey = nsecToPrivateKey(key as any);
					} else {
						hexKey = key as PrivateKeyHex;
					}
					
					derivedPrivateKey = hexKey;
					derivedPublicKey = privateKeyToPublicKey(hexKey);
					showAuthSetup = true;
				} catch (error) {
					console.error('Failed to prepare key for auth setup:', error);
				}
			}
		}
	}

	function handleAuthSetupComplete() {
		derivedPrivateKey = null;
		derivedPublicKey = null;
	}

	function togglePrivateKeyVisibility() {
		if (showPrivateKey) {
			// Just hide it
			showPrivateKey = false;
		} else {
			// Request unlock to show
			requestViewPrivateKey();
		}
	}
	
	function toggleMnemonicVisibility() {
		if (showMnemonic) {
			// Just hide it
			showMnemonic = false;
		} else {
			// Request unlock to show
			requestViewMnemonic();
		}
	}
</script>

<AccordionItem>
	<!-- Nostr Keys Section (now collapsible) -->
	<AccordionTrigger>
		<span class="flex w-full gap-2 text-left">
			<Key />
			Nostr Keys
		</span>
	</AccordionTrigger>
	<AccordionContent>
		<div class="mt-4 space-y-3 px-1">
			<!-- Security Status -->
			{#if securityState.authMethod === 'pin'}
				<div class="flex items-center gap-2 text-xs text-green-600">
					<ShieldCheck class="h-3 w-3" />
					<span>Protected with {securityState.pinLength}-digit PIN</span>
				</div>
			{:else if securityState.authMethod === 'webauthn'}
				<div class="flex items-center gap-2 text-xs text-green-600">
					<ShieldCheck class="h-3 w-3" />
					<span>Protected with Biometrics</span>
				</div>
			{:else if securityState.hasStoredKey || hasNdkPrivateKey}
				<!-- Insecure storage - offer to secure -->
				<Alert variant="warning" class="py-2">
					<Lock class="h-3 w-3" />
					<AlertDescription class="text-xs">
						Your key is not protected.
						<button
							class="ml-1 underline hover:no-underline"
							onclick={handleSetupAuth}
						>
							Secure your wallet
						</button>
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Public Key Display -->
			<div>
				<div class="mb-1 text-xs text-muted-foreground">Public Key (npub)</div>
				<div class="flex">
					<code
						class="flex-1 overflow-hidden overflow-ellipsis whitespace-nowrap rounded bg-muted p-2 text-xs"
					>
						{npub || 'Not available'}
					</code>
					<Button
						variant="ghost"
						size="icon"
						class="ml-2 h-8 w-8"
						disabled={!npub}
						onclick={() => copyToClipboard(npub, 'Public key')}
					>
						<Copy class="h-3 w-3" />
					</Button>
				</div>
			</div>

			<!-- Private Key Display -->
			{#if hasNdkPrivateKey || securityState.authMethod !== 'none'}
				<div>
					<Alert variant="destructive" class="mb-2 py-2 text-xs">
						<AlertDescription>
							Your private key is sensitive information. Never share it with anyone.
						</AlertDescription>
					</Alert>

					<div>
						<div class="mb-1 text-xs text-muted-foreground">Private Key (nsec)</div>
						<div class="flex">
							<code
								class="flex-1 overflow-hidden overflow-ellipsis whitespace-nowrap rounded bg-muted p-2 text-xs"
							>
								{#if showPrivateKey && privateKey}
									{privateKey}
								{:else}
									••••••••••••••••••••••••••••••••
								{/if}
							</code>
							<Button
								variant="ghost"
								size="icon"
								class="ml-2 h-8 w-8"
								onclick={togglePrivateKeyVisibility}
							>
								{#if showPrivateKey}
									<EyeOff class="h-3 w-3" />
								{:else}
									<Eye class="h-3 w-3" />
								{/if}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="ml-2 h-8 w-8"
								onclick={requestCopyPrivateKey}
							>
								<Copy class="h-3 w-3" />
							</Button>
						</div>
					</div>
				</div>
			{:else}
				<div class="text-xs text-muted-foreground">
					Private key not available. You may be using a browser extension for authentication.
				</div>
			{/if}

			<!-- Seed Phrase Display (if available) -->
			{#if hasMnemonic}
				<div class="mt-4 border-t pt-4">
					<div class="mb-2 flex items-center gap-2">
						<KeySquare class="h-4 w-4" />
						<span class="text-sm font-medium">Seed Phrase</span>
					</div>
					
					<Alert variant="destructive" class="mb-2 py-2 text-xs">
						<AlertDescription>
							Your seed phrase is your ultimate recovery key. Never share it with anyone.
						</AlertDescription>
					</Alert>

					<div>
						<div class="mb-1 text-xs text-muted-foreground">24-Word Recovery Phrase</div>
						<div class="flex">
							<code
								class="flex-1 overflow-hidden overflow-ellipsis whitespace-nowrap rounded bg-muted p-2 text-xs"
							>
								{#if showMnemonic && mnemonic}
									{mnemonic.split(' ').slice(0, 3).join(' ')}...
								{:else}
									••••••••••••••••••••••••••••••••
								{/if}
							</code>
							<Button
								variant="ghost"
								size="icon"
								class="ml-2 h-8 w-8"
								onclick={toggleMnemonicVisibility}
							>
								{#if showMnemonic}
									<EyeOff class="h-3 w-3" />
								{:else}
									<Eye class="h-3 w-3" />
								{/if}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="ml-2 h-8 w-8"
								onclick={requestCopyMnemonic}
							>
								<Copy class="h-3 w-3" />
							</Button>
						</div>
						
						{#if showMnemonic && mnemonic}
							<div class="mt-2 grid grid-cols-4 gap-1 rounded bg-muted p-2">
								{#each mnemonic.split(' ') as word, i}
									<div class="text-xs">
										<span class="text-muted-foreground">{i + 1}.</span> {word}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</AccordionContent>
</AccordionItem>

<!-- Unlock Dialog -->
<UnlockDialog
	bind:open={showUnlockDialog}
	title="Unlock Wallet"
	description="Authenticate to access your private key"
	onSuccess={handleUnlockSuccess}
	onCancel={() => (pendingAction = null)}
/>

<!-- Security Warning Dialog -->
<SecurityWarningDialog
	bind:open={showSecurityWarning}
	title="Unprotected Private Key"
	description="Your private key is not protected. Anyone with access to this device can view and copy your key."
	showSetupPIN={true}
	onProceed={handleSecurityWarningProceed}
	onSetupPIN={handleSetupAuth}
	onCancel={() => (pendingAction = null)}
/>

<!-- Auth Setup Dialog -->
{#if derivedPrivateKey && derivedPublicKey}
	<AuthSetupDialog
		bind:open={showAuthSetup}
		privateKeyHex={derivedPrivateKey}
		publicKeyHex={derivedPublicKey}
		onComplete={handleAuthSetupComplete}
	/>
{/if}
