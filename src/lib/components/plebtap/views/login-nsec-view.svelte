<!-- src/lib/components/nostr/NostrPrivateKeyView.svelte -->
<script lang="ts">
	import { isConnecting, privateKeyLogin } from '$lib/stores/nostr.js';
	import { appState, InitStatus } from '$lib/services/init.svelte.js';
	import { navigateTo } from '$lib/stores/navigation.js';
	import ViewContainer from './view-container.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Input from '$lib/components/ui/input/input.svelte';
	import { Alert, AlertTitle, AlertDescription } from '$lib/components/ui/alert/index.js';
	import { AuthSetupDialog } from '$lib/components/plebtap/dialogs/index.js';
	import { nsecToPrivateKey, privateKeyToPublicKey, privateKeyToNsec } from '$lib/services/crypto.js';
	import type { Nsec, PrivateKeyHex, PublicKeyHex } from '$lib/types/security.js';
	import { initWallet } from '$lib/stores/wallet.js';

	let privateKeyInput = $state('');
	let errorMessage = $state('');
	
	// Auth setup state
	let showAuthSetup = $state(false);
	let derivedPrivateKey = $state<PrivateKeyHex | null>(null);
	let derivedPublicKey = $state<PublicKeyHex | null>(null);
	let nsecForLogin = $state('');

	// Check if input looks like a hex key (64 hex characters)
	function isHexKey(input: string): boolean {
		return /^[0-9a-fA-F]{64}$/.test(input.trim());
	}

	async function handlePrivateKeyLogin(event: SubmitEvent) {
		// Prevent the default form submission behavior
		event.preventDefault();

		const trimmedInput = privateKeyInput.trim();

		if (!trimmedInput) {
			errorMessage = 'Please enter your private key';
			return;
		}

		try {
			errorMessage = '';
			
			let privateKeyHex: PrivateKeyHex;
			
			if (isHexKey(trimmedInput)) {
				// Input is hex format
				privateKeyHex = trimmedInput.toLowerCase() as PrivateKeyHex;
				nsecForLogin = privateKeyToNsec(privateKeyHex);
			} else if (trimmedInput.startsWith('nsec1')) {
				// Input is nsec format
				privateKeyHex = nsecToPrivateKey(trimmedInput as Nsec);
				nsecForLogin = trimmedInput;
			} else {
				errorMessage = 'Invalid private key format. Please enter an nsec or 64-character hex key.';
				return;
			}
			
			const publicKeyHex = privateKeyToPublicKey(privateKeyHex);
			
			derivedPrivateKey = privateKeyHex;
			derivedPublicKey = publicKeyHex;
			
			// Show auth setup dialog to encrypt the key
			showAuthSetup = true;

		} catch (error) {
			if (error instanceof Error) {
				errorMessage = error.message;
			} else {
				errorMessage = 'Invalid private key format';
			}
			console.error('Login error:', error);
		}
	}
	
	async function handleAuthSetupComplete() {
		showAuthSetup = false;
		
		try {
			// Now login with the private key (always use nsec format for login)
			await privateKeyLogin(nsecForLogin);
			
			// Initialize wallet
			await initWallet();
			
			// Navigate to main
			navigateTo('main');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Login failed after setup';
		}
	}
</script>

<ViewContainer className="p-4">
	<div class="mb-4 flex items-center">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('login')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Private Key Login</h3>
	</div>

	<!-- Security Notice -->
	<Alert class="mb-4">
		<CircleAlert class="h-4 w-4" />
		<AlertTitle>Security Notice</AlertTitle>
		<AlertDescription class="text-xs">
			For the best experience, we recommend using a browser extension to login.
		</AlertDescription>
	</Alert>

	<!-- Error message display -->
	{#if errorMessage}
		<Alert variant="destructive" class="mb-4">
			<AlertDescription>{errorMessage}</AlertDescription>
		</Alert>
	{/if}

	<div class="space-y-4">
		<p class="text-sm text-muted-foreground">Enter your private key (nsec or hex) to sign in.</p>

		<form onsubmit={handlePrivateKeyLogin} class="space-y-2">
			<!-- Hidden username field for accessibility and password managers -->
			<Input type="text" class="hidden" autocomplete="username" value="nsec-private-key" />
			<Input
				type="password"
				placeholder="nsec1... or hex"
				bind:value={privateKeyInput}
				class="font-mono text-sm"
				autocomplete="current-password"
				disabled={appState.status === InitStatus.INITIALIZING}
			/>
			<Button
				type="submit"
				class="w-full"
				disabled={!privateKeyInput.trim() ||
					$isConnecting ||
					appState.status === InitStatus.INITIALIZING}
			>
				{appState.status === InitStatus.INITIALIZING
					? 'Initializing...'
					: $isConnecting
						? 'Signing in...'
						: 'Sign In'}
			</Button>
		</form>
	</div>
</ViewContainer>

<!-- Auth Setup Dialog -->
{#if derivedPrivateKey && derivedPublicKey}
	<AuthSetupDialog
		bind:open={showAuthSetup}
		privateKeyHex={derivedPrivateKey}
		publicKeyHex={derivedPublicKey}
		onComplete={handleAuthSetupComplete}
	/>
{/if}
