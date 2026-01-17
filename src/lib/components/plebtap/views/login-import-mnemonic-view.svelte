<!-- src/lib/components/plebtap/views/login-import-mnemonic-view.svelte -->
<script lang="ts">
	import { login } from '$lib/stores/nostr.js';
	import { appState, InitStatus } from '$lib/services/init.svelte.js';
	import { navigateTo } from '$lib/stores/navigation.js';
	import ViewContainer from './view-container.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Alert, AlertTitle, AlertDescription } from '$lib/components/ui/alert/index.js';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	import {
		validateMnemonic,
		deriveKeyPair,
		privateKeyToNsec
	} from '$lib/services/crypto.js';
	import { AuthSetupDialog } from '$lib/components/plebtap/dialogs/index.js';
	import type { Mnemonic, PrivateKeyHex, PublicKeyHex } from '$lib/types/security.js';

	// State
	let mnemonicInput = $state('');
	let passphrase = $state('');
	let showPassphrase = $state(false);
	let errorMessage = $state('');
	let isLoading = $state(false);

	// Auth setup state
	let showAuthSetup = $state(false);
	let derivedPrivateKey = $state<PrivateKeyHex | null>(null);
	let derivedPublicKey = $state<PublicKeyHex | null>(null);
	let validatedMnemonic = $state<Mnemonic | null>(null);

	// Reactive validation
	let wordCount = $derived(mnemonicInput.trim().split(/\s+/).filter(Boolean).length);
	let isValidWordCount = $derived([12, 15, 18, 21, 24].includes(wordCount));

	async function handleImport(event: SubmitEvent) {
		event.preventDefault();

		if (!mnemonicInput.trim()) {
			errorMessage = 'Please enter your seed phrase';
			return;
		}

		if (!isValidWordCount) {
			errorMessage = `Invalid word count (${wordCount}). Seed phrase must be 12, 15, 18, 21, or 24 words.`;
			return;
		}

		if (!validateMnemonic(mnemonicInput)) {
			errorMessage = 'Invalid seed phrase. Please check your words and try again.';
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			// Derive the key pair
			const mnemonic = mnemonicInput.trim() as Mnemonic;
			const keyPair = deriveKeyPair(mnemonic, passphrase);
			
			// Store for auth setup
			derivedPrivateKey = keyPair.privateKeyHex;
			derivedPublicKey = keyPair.publicKeyHex;
			validatedMnemonic = mnemonic;
			
			// Show auth setup dialog
			showAuthSetup = true;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to import seed phrase';
			console.error('Import error:', error);
		} finally {
			isLoading = false;
		}
	}

	async function handleAuthSetupComplete() {
		if (!derivedPrivateKey) {
			errorMessage = 'No key available. Please try again.';
			return;
		}

		isLoading = true;

		try {
			// Convert to nsec for login
			const nsec = privateKeyToNsec(derivedPrivateKey);
			
			// Note: We don't call initializeSecurity() here because the auth setup
			// functions (setupPINAuth, setupWebAuthnAuth, storeInsecurely) already
			// set the correct security state including isUnlocked = true

			// Login with the derived key
			await login({
				method: 'private-key',
				privateKey: nsec
			});

			// Clear sensitive data
			mnemonicInput = '';
			passphrase = '';
			derivedPrivateKey = null;
			derivedPublicKey = null;
			validatedMnemonic = null;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to complete login';
			console.error('Login error:', error);
		} finally {
			isLoading = false;
		}
	}
</script>

<ViewContainer className="p-4">
	<div class="mb-4 flex items-center">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('login')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Import Seed Phrase</h3>
	</div>

	<!-- Security info -->
	<Alert class="mb-4">
		<ShieldCheck class="h-4 w-4" />
		<AlertTitle>Secure Import</AlertTitle>
		<AlertDescription class="text-xs">
			Your seed phrase will be used to derive your Nostr keys using NIP-06 derivation.
		</AlertDescription>
	</Alert>

	<!-- Error message display -->
	{#if errorMessage}
		<Alert variant="destructive" class="mb-4">
			<CircleAlert class="h-4 w-4" />
			<AlertDescription>{errorMessage}</AlertDescription>
		</Alert>
	{/if}

	<form onsubmit={handleImport} class="space-y-4">
		<div class="space-y-2">
			<label for="mnemonic" class="text-sm font-medium">
				Seed Phrase ({wordCount} words)
			</label>
			<textarea
				id="mnemonic"
				bind:value={mnemonicInput}
				placeholder="Enter your 12 or 24 word seed phrase..."
				class="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				disabled={isLoading || appState.status === InitStatus.INITIALIZING}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
			></textarea>
			<p class="text-xs text-muted-foreground">
				{#if !isValidWordCount && wordCount > 0}
					<span class="text-amber-600">
						Expecting 12, 15, 18, 21, or 24 words
					</span>
				{:else if isValidWordCount}
					<span class="text-green-600">✓ Valid word count</span>
				{:else}
					Separate words with spaces
				{/if}
			</p>
		</div>

		<!-- Optional passphrase (BIP-39) -->
		<div class="space-y-2">
			<button
				type="button"
				class="text-xs text-muted-foreground hover:underline"
				onclick={() => (showPassphrase = !showPassphrase)}
			>
				{showPassphrase ? '− Hide' : '+ Add'} optional passphrase (advanced)
			</button>

			{#if showPassphrase}
				<div class="space-y-1">
					<input
						type="password"
						bind:value={passphrase}
						placeholder="Optional BIP-39 passphrase"
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						disabled={isLoading}
						autocomplete="off"
					/>
					<p class="text-xs text-muted-foreground">
						If you used a passphrase when creating this seed, enter it here.
					</p>
				</div>
			{/if}
		</div>

		<Button
			type="submit"
			class="w-full"
			disabled={!mnemonicInput.trim() ||
				!isValidWordCount ||
				isLoading ||
				appState.status === InitStatus.INITIALIZING}
		>
			{#if isLoading}
				<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
				Importing...
			{:else}
				Continue
			{/if}
		</Button>
	</form>

	<p class="mt-4 text-center text-xs text-muted-foreground">
		Your seed phrase is only used locally and never transmitted.
	</p>
</ViewContainer>

<!-- Auth Setup Dialog -->
{#if derivedPrivateKey && derivedPublicKey && validatedMnemonic}
	<AuthSetupDialog
		bind:open={showAuthSetup}
		privateKeyHex={derivedPrivateKey}
		publicKeyHex={derivedPublicKey}
		mnemonic={validatedMnemonic}
		onComplete={handleAuthSetupComplete}
	/>
{/if}
