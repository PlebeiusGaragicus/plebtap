<!-- src/lib/components/nostr/NostrPrivateKeyView.svelte -->
<script lang="ts">
	import { isConnecting, privateKeyLogin } from '$lib/stores/nostr.js';
	import { appState, InitStatus } from '$lib/services/init.svelte.js';
	import { navigateTo } from '$lib/stores/navigation.js';
	import ViewContainer from './view-container.svelte';
	import { slide } from 'svelte/transition';
	import Button from '$lib/components/ui/button/button.svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Input from '$lib/components/ui/input/input.svelte';
	import { Alert, AlertTitle, AlertDescription } from '$lib/components/ui/alert/index.js';
	import { AuthSetupDialog } from '$lib/components/plebtap/dialogs/index.js';
	import { nsecToPrivateKey, privateKeyToPublicKey } from '$lib/services/crypto.js';
	import type { Nsec, PrivateKeyHex, PublicKeyHex } from '$lib/types/security.js';
	import { initWallet } from '$lib/stores/wallet.js';

	let privateKey = $state('');
	let errorMessage = $state('');
	let securityWarningAccepted = $state(false);
	
	// Auth setup state
	let showAuthSetup = $state(false);
	let derivedPrivateKey = $state<PrivateKeyHex | null>(null);
	let derivedPublicKey = $state<PublicKeyHex | null>(null);

	async function handlePrivateKeyLogin(event: SubmitEvent) {
		// Prevent the default form submission behavior
		event.preventDefault();

		if (!privateKey) {
			errorMessage = 'Please enter your private key';
			return;
		}

		try {
			errorMessage = '';
			
			// Convert nsec to hex (user input treated as Nsec)
			const privateKeyHex = nsecToPrivateKey(privateKey as Nsec);
			const publicKeyHex = privateKeyToPublicKey(privateKeyHex);
			
			derivedPrivateKey = privateKeyHex;
			derivedPublicKey = publicKeyHex;
			
			// Show auth setup dialog to encrypt the key
			showAuthSetup = true;

		} catch (error) {
			if (error instanceof Error) {
				errorMessage = error.message;
			} else {
				errorMessage = 'Unknown error during login';
			}
			console.error('Login error:', error);
		}
	}
	
	async function handleAuthSetupComplete() {
		showAuthSetup = false;
		
		try {
			// Now login with the private key
			await privateKeyLogin(privateKey);
			
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
	{#if !securityWarningAccepted}
		<div transition:slide>
			<Alert class="mb-4">
				<CircleAlert class="h-4 w-4" />
				<AlertTitle>Security Notice</AlertTitle>
				<AlertDescription class="mt-2 space-y-3">
					<p class="text-sm">
						Your private key will be encrypted and stored securely using PIN or biometric protection.
						For the best experience, we recommend <strong>creating a new account</strong> with seed phrase backup.
					</p>
					<Button size="sm" onclick={() => (securityWarningAccepted = true)} class="mt-2">
						Continue
					</Button>
				</AlertDescription>
			</Alert>
		</div>
	{/if}

	<!-- Error message display -->
	{#if errorMessage}
		<div
			class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
			role="alert"
		>
			<span class="block sm:inline">{errorMessage}</span>
		</div>
	{/if}

	<div class="space-y-4">
		<p class="text-sm text-muted-foreground">Enter your private key (nsec) to sign in.</p>

		<form onsubmit={handlePrivateKeyLogin} class="space-y-2">
			<!-- Hidden username field for accessibility and password managers -->
			<Input type="text" class="hidden" autocomplete="username" value="nsec-private-key" />
			<Input
				type="password"
				placeholder="nsec1..."
				bind:value={privateKey}
				class="font-mono text-sm"
				autocomplete="current-password"
				disabled={!securityWarningAccepted || appState.status === InitStatus.INITIALIZING}
			/>
			<Button
				type="submit"
				class="w-full"
				disabled={!securityWarningAccepted ||
					!privateKey ||
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
