<!-- src/lib/components/plebtap/views/login-generate-key-view.svelte -->
<script lang="ts">
	import { login, generateNewKeypair } from '$lib/stores/nostr.js';
	import { appState, InitStatus } from '$lib/services/init.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Alert, AlertTitle, AlertDescription } from '$lib/components/ui/alert/index.js';
	import { navigateTo } from '$lib/stores/navigation.js';
	import ViewContainer from './view-container.svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Zap from '@lucide/svelte/icons/zap';
	import KeySquare from '@lucide/svelte/icons/key-square';

	import {
		generateMnemonic,
		getMnemonicWords,
		selectRandomWordIndices,
		deriveKeyPair,
		privateKeyToNsec,
		privateKeyToPublicKey
	} from '$lib/services/crypto.js';
	import { AuthSetupDialog } from '$lib/components/plebtap/dialogs/index.js';
	import type { Mnemonic, PrivateKeyHex, PublicKeyHex } from '$lib/types/security.js';

	// State
	type Step = 'choose' | 'backup' | 'verify' | 'pin' | 'complete';
	let step = $state<Step>('choose');
	let errorMessage = $state('');
	let isLoading = $state(false);

	// Word count choice (12 or 24)
	type WordCount = 12 | 24;
	let wordCount = $state<WordCount>(12);

	// Mnemonic state
	let mnemonic = $state<Mnemonic | null>(null);
	let mnemonicWords = $state<string[]>([]);
	let showMnemonic = $state(false);
	let mnemonicCopied = $state(false);
	let backupConfirmed = $state(false);

	// Verification state
	let verificationIndices = $state<number[]>([]);
	let verificationInputs = $state<string[]>(['', '', '']);
	let verificationAttempts = $state(0);

	// Key pair state
	let derivedPrivateKey = $state<PrivateKeyHex | null>(null);
	let derivedPublicKey = $state<PublicKeyHex | null>(null);

	// Auth setup state
	let showAuthSetup = $state(false);

	// Quick generate - no seed phrase backup
	function handleQuickGenerate() {
		isLoading = true;
		errorMessage = '';
		
		try {
			// Generate a random private key (hex format from NDK)
			const privateKeyHex = generateNewKeypair() as PrivateKeyHex;
			const publicKeyHex = privateKeyToPublicKey(privateKeyHex);
			
			derivedPrivateKey = privateKeyHex;
			derivedPublicKey = publicKeyHex;
			mnemonic = null; // No mnemonic for quick generate
			
			step = 'pin';
			showAuthSetup = true;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to generate key';
		} finally {
			isLoading = false;
		}
	}

	// Generate with seed phrase - show backup flow
	function handleShowSeedWords() {
		const entropy = wordCount === 12 ? 128 : 256;
		mnemonic = generateMnemonic(entropy);
		mnemonicWords = getMnemonicWords(mnemonic);
		verificationIndices = selectRandomWordIndices(mnemonicWords.length, 3);
		verificationInputs = ['', '', ''];
		backupConfirmed = false;
		step = 'backup';
	}

	async function copyMnemonic() {
		if (!mnemonic) return;
		try {
			await navigator.clipboard.writeText(mnemonic);
			mnemonicCopied = true;
			setTimeout(() => (mnemonicCopied = false), 2000);
		} catch (error) {
			console.error('Failed to copy:', error);
		}
	}

	function proceedToVerification() {
		if (!backupConfirmed) {
			errorMessage = 'Please confirm that you have backed up your seed phrase';
			return;
		}
		errorMessage = '';
		step = 'verify';
	}

	function verifyMnemonic() {
		errorMessage = '';
		
		const allCorrect = verificationIndices.every((wordIndex, i) => {
			const expected = mnemonicWords[wordIndex].toLowerCase();
			const provided = verificationInputs[i].toLowerCase().trim();
			return expected === provided;
		});

		if (allCorrect) {
			// Derive keys
			if (mnemonic) {
				const keyPair = deriveKeyPair(mnemonic);
				derivedPrivateKey = keyPair.privateKeyHex;
				derivedPublicKey = keyPair.publicKeyHex;
			}
			step = 'pin';
			showAuthSetup = true;
		} else {
			verificationAttempts++;
			if (verificationAttempts >= 3) {
				errorMessage = 'Too many incorrect attempts. Please write down your words carefully and try again.';
				step = 'backup';
				verificationAttempts = 0;
				backupConfirmed = false;
				verificationInputs = ['', '', ''];
			} else {
				errorMessage = `Incorrect words. Please check your backup. (Attempt ${verificationAttempts}/3)`;
				verificationInputs = ['', '', ''];
			}
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

			// Clear sensitive data from memory
			mnemonic = null;
			mnemonicWords = [];
			derivedPrivateKey = null;
			derivedPublicKey = null;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to complete setup';
			console.error('Setup error:', error);
		} finally {
			isLoading = false;
		}
	}

	function skipVerification() {
		// Allow skipping for users who are confident
		if (mnemonic) {
			const keyPair = deriveKeyPair(mnemonic);
			derivedPrivateKey = keyPair.privateKeyHex;
			derivedPublicKey = keyPair.publicKeyHex;
		}
		step = 'pin';
		showAuthSetup = true;
	}

	function getTitle(): string {
		switch (step) {
			case 'choose':
				return 'Generate New Keypair';
			case 'backup':
				return 'Back Up Your Seed Phrase';
			case 'verify':
				return 'Verify Your Backup';
			case 'pin':
			case 'complete':
				return 'Secure Your Wallet';
			default:
				return 'Generate New Keypair';
		}
	}
</script>

<ViewContainer className="p-4">
	<div class="mb-4 flex items-center">
		<Button variant="ghost" size="icon" onclick={() => step === 'choose' ? navigateTo('login') : step = 'choose'} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">{getTitle()}</h3>
	</div>

	<!-- Error message display -->
	{#if errorMessage}
		<Alert variant="destructive" class="mb-4">
			<ShieldAlert class="h-4 w-4" />
			<AlertDescription>{errorMessage}</AlertDescription>
		</Alert>
	{/if}

	{#if step === 'choose'}
		<!-- Choice screen: Quick Generate vs Show Seed Phrase -->
		<div class="space-y-4">
			<!-- Quick Generate option -->
			<button
				class="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/50"
				onclick={handleQuickGenerate}
				disabled={isLoading}
			>
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
						<Zap class="h-5 w-5 text-foreground" />
					</div>
					<div class="flex-1">
						<p class="font-medium">Generate Private Key</p>
						<p class="text-sm text-muted-foreground">
							Quick start - no mnemonic.
						</p>
					</div>
				</div>
			</button>

			<!-- Show Seed Phrase option -->
			<button
				class="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/50"
				onclick={handleShowSeedWords}
				disabled={isLoading}
			>
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
						<KeySquare class="h-5 w-5 text-foreground" />
					</div>
					<div class="flex-1">
						<p class="font-medium">Generate Seed Phrase</p>
						<p class="text-sm text-muted-foreground">
							BIP-39 mnemonic with NIP-06 derivation path.
						</p>
					</div>
				</div>
			</button>

			<!-- Word count toggle -->
			<div class="flex items-center justify-center gap-4 pt-2">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="radio"
						name="wordCount"
						value={12}
						checked={wordCount === 12}
						onchange={() => wordCount = 12}
						class="h-4 w-4"
					/>
					<span class="text-sm">12 words</span>
				</label>
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="radio"
						name="wordCount"
						value={24}
						checked={wordCount === 24}
						onchange={() => wordCount = 24}
						class="h-4 w-4"
					/>
					<span class="text-sm">24 words</span>
				</label>
			</div>

			{#if isLoading}
				<div class="flex items-center justify-center py-4">
					<LoaderCircle class="h-6 w-6 animate-spin text-primary" />
				</div>
			{/if}
		</div>

	{:else if step === 'backup' && mnemonic}
		<div class="space-y-4">
			<Alert variant="warning">
				<ShieldAlert class="h-4 w-4" />
				<AlertTitle>Write This Down!</AlertTitle>
				<AlertDescription class="text-xs">
					This is your recovery phrase. Write it down on paper and store it safely. 
					You can export it later from Settings, but having a backup is essential.
				</AlertDescription>
			</Alert>

			<!-- Mnemonic display -->
			<div class="rounded-lg border bg-muted/50 p-4">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-medium text-muted-foreground">{wordCount}-Word Seed Phrase</span>
					<div class="flex gap-1">
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (showMnemonic = !showMnemonic)}
						>
							{#if showMnemonic}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onclick={copyMnemonic}
						>
							{#if mnemonicCopied}
								<Check class="h-4 w-4 text-green-500" />
							{:else}
								<Copy class="h-4 w-4" />
							{/if}
						</Button>
					</div>
				</div>

				<div class="grid grid-cols-3 gap-2">
					{#each mnemonicWords as word, i}
						<div class="flex items-center gap-2 rounded bg-background px-2 py-1.5">
							<span class="text-xs text-muted-foreground">{i + 1}.</span>
							{#if showMnemonic}
								<span class="font-mono text-sm">{word}</span>
							{:else}
								<span class="font-mono text-sm text-muted-foreground">••••••</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<label class="flex items-start gap-2">
				<input
					type="checkbox"
					bind:checked={backupConfirmed}
					class="mt-1 rounded border-muted-foreground"
				/>
				<span class="text-sm">
					I have written down my seed phrase and stored it in a safe place.
					I understand this is the only way to recover my wallet.
				</span>
			</label>

			<Button
				class="w-full"
				onclick={proceedToVerification}
				disabled={!backupConfirmed}
			>
				Continue to Verification
			</Button>
		</div>

	{:else if step === 'verify'}
		<div class="space-y-4">
			<p class="text-sm text-muted-foreground">
				Please enter the following words from your seed phrase to verify your backup.
			</p>

			<div class="space-y-3">
				{#each verificationIndices as wordIndex, i}
					<div class="space-y-1">
						<label for={`verify-${i}`} class="text-sm font-medium">
							Word #{wordIndex + 1}
						</label>
						<input
							id={`verify-${i}`}
							type="text"
							bind:value={verificationInputs[i]}
							placeholder={`Enter word #${wordIndex + 1}`}
							class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							autocomplete="off"
							autocorrect="off"
							autocapitalize="off"
							spellcheck="false"
						/>
					</div>
				{/each}
			</div>

			<div class="flex gap-2">
				<Button
					variant="outline"
					class="flex-1"
					onclick={() => {
						step = 'backup';
						verificationInputs = ['', '', ''];
						errorMessage = '';
					}}
				>
					Back
				</Button>
				<Button
					class="flex-1"
					onclick={verifyMnemonic}
					disabled={verificationInputs.some((v) => !v.trim())}
				>
					Verify
				</Button>
			</div>

			<button
				type="button"
				class="w-full text-center text-xs text-muted-foreground hover:underline"
				onclick={skipVerification}
			>
				Skip verification (not recommended)
			</button>
		</div>

	{:else if step === 'pin' || step === 'complete'}
		<div class="flex flex-col items-center justify-center space-y-4 py-8">
			{#if isLoading}
				<LoaderCircle class="h-12 w-12 animate-spin text-primary" />
				<p class="text-sm font-medium">Setting up your account...</p>
			{:else if showAuthSetup}
				<!-- Show waiting state while auth dialog is open -->
				<LoaderCircle class="h-12 w-12 animate-spin text-primary" />
				<p class="text-sm font-medium">Complete security setup...</p>
			{:else}
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
					<Check class="h-6 w-6 text-green-600" />
				</div>
				<p class="text-sm font-medium">Account ready!</p>
			{/if}
		</div>

	{:else}
		<!-- Loading state -->
		<div class="flex flex-col items-center justify-center space-y-4 py-8">
			<LoaderCircle class="h-12 w-12 animate-spin text-primary" />
			<p class="text-sm font-medium">Generating your new account...</p>
		</div>
	{/if}
</ViewContainer>

<!-- Auth Setup Dialog -->
{#if derivedPrivateKey && derivedPublicKey}
	<AuthSetupDialog
		bind:open={showAuthSetup}
		privateKeyHex={derivedPrivateKey}
		publicKeyHex={derivedPublicKey}
		mnemonic={mnemonic ?? undefined}
		onComplete={handleAuthSetupComplete}
	/>
{/if}
