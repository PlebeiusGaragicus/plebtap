<!-- src/lib/components/plebtap/dialogs/auth-setup-dialog.svelte -->
<!-- Authentication setup dialog: User chooses PIN OR WebAuthn, or skips security -->
<script lang="ts">
	import { InputOTP, InputOTPGroup, InputOTPSlot } from '$lib/components/ui/input-otp/index.js';
	import { REGEXP_ONLY_DIGITS } from 'bits-ui';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Check from '@lucide/svelte/icons/check';
	import Fingerprint from '@lucide/svelte/icons/fingerprint';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import { setupPINAuth, setupWebAuthnAuth, storeInsecurely, securityState } from '$lib/stores/security.svelte.js';
	import type { PrivateKeyHex, PublicKeyHex, PinLength, Mnemonic } from '$lib/types/security.js';

	// Props
	interface Props {
		open?: boolean;
		privateKeyHex: PrivateKeyHex;
		publicKeyHex: PublicKeyHex;
		/** Optional mnemonic to store encrypted alongside the key */
		mnemonic?: Mnemonic;
		onComplete?: () => void;
	}

	let {
		open = $bindable(false),
		privateKeyHex,
		publicKeyHex,
		mnemonic,
		onComplete
	}: Props = $props();

	// State
	type Step = 'choose' | 'pin-enter' | 'pin-confirm' | 'webauthn' | 'complete';
	let step = $state<Step>('choose');
	let authChoice = $state<'pin' | 'webauthn' | 'insecure' | null>(null);
	let pinLength = $state<PinLength>(4); // Default to 4-digit
	let pin = $state('');
	let confirmPin = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');

	// Reset state when dialog opens
	$effect(() => {
		if (open) {
			step = 'choose';
			authChoice = null;
			pinLength = 4;
			pin = '';
			confirmPin = '';
			errorMessage = '';
			isLoading = false;
		}
	});

	async function selectAuthMethod(method: 'pin' | 'webauthn' | 'insecure') {
		authChoice = method;
		errorMessage = '';
		if (method === 'pin') {
			step = 'pin-enter';
		} else if (method === 'webauthn') {
			step = 'webauthn';
		} else {
			// Store insecurely immediately (no confirmation)
			await handleInsecureStorage();
		}
	}

	function togglePinLength() {
		pinLength = pinLength === 4 ? 6 : 4;
		pin = ''; // Clear PIN when switching length
	}

	function handlePinEntered() {
		if (pin.length !== pinLength) {
			errorMessage = `PIN must be exactly ${pinLength} digits`;
			return;
		}
		errorMessage = '';
		step = 'pin-confirm';
	}

	function handleConfirmPin() {
		if (confirmPin !== pin) {
			errorMessage = 'PINs do not match. Please try again.';
			confirmPin = '';
			return;
		}
		handlePINComplete();
	}

	async function handlePINComplete() {
		isLoading = true;
		errorMessage = '';

		try {
			const result = await setupPINAuth(privateKeyHex, publicKeyHex, pin, pinLength, mnemonic);

			if (!result.success) {
				errorMessage = result.error || 'Failed to set up PIN';
				isLoading = false;
				return;
			}

			step = 'complete';

			// Auto-close after showing success
			setTimeout(() => {
				onComplete?.();
				open = false;
			}, 1500);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred';
		} finally {
			isLoading = false;
		}
	}

	async function handleWebAuthnSetup() {
		isLoading = true;
		errorMessage = '';

		try {
			const result = await setupWebAuthnAuth(privateKeyHex, publicKeyHex, mnemonic);

			if (!result.success) {
				errorMessage = result.error || 'Failed to set up biometrics';
				isLoading = false;
				return;
			}

			step = 'complete';

			setTimeout(() => {
				onComplete?.();
				open = false;
			}, 1500);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred';
		} finally {
			isLoading = false;
		}
	}

	async function handleInsecureStorage() {
		isLoading = true;
		errorMessage = '';

		try {
			const result = await storeInsecurely(privateKeyHex, publicKeyHex, mnemonic);

			if (!result.success) {
				errorMessage = result.error || 'Failed to store key';
				isLoading = false;
				return;
			}

			step = 'complete';

			setTimeout(() => {
				onComplete?.();
				open = false;
			}, 1500);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred';
		} finally {
			isLoading = false;
		}
	}

	function goBack() {
		errorMessage = '';
		if (step === 'pin-enter' || step === 'webauthn') {
			step = 'choose';
			authChoice = null;
			pin = '';
		} else if (step === 'pin-confirm') {
			step = 'pin-enter';
			confirmPin = '';
		}
	}

	function getTitle(): string {
		switch (step) {
			case 'complete':
				return 'Setup Complete';
			case 'webauthn':
				return 'Enable Biometrics';
			case 'pin-confirm':
				return 'Confirm Your PIN';
			case 'pin-enter':
				return 'Create Your PIN';
			default:
				return 'Secure Your Wallet';
		}
	}

	function getDescription(): string {
		switch (step) {
			case 'complete':
				return authChoice === 'insecure' ? 'Your wallet has been saved.' : 'Your wallet is now protected.';
			case 'webauthn':
				return 'Use Face ID, Touch ID, or your device authenticator.';
			case 'pin-confirm':
				return 'Please re-enter your PIN to confirm.';
			case 'pin-enter':
				return `Enter a ${pinLength}-digit PIN.`;
			default:
				return 'Choose how you want to protect your wallet.';
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="border-border bg-background sm:max-w-md" interactOutsideBehavior="ignore" showCloseButton={false}>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<ShieldCheck class="h-5 w-5" />
				{getTitle()}
			</DialogTitle>
			<DialogDescription>
				{getDescription()}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			{#if errorMessage}
				<Alert variant="destructive">
					<CircleAlert class="h-4 w-4" />
					<AlertDescription>{errorMessage}</AlertDescription>
				</Alert>
			{/if}

			{#if step === 'choose'}
				<div class="space-y-3">
					<!-- PIN Option -->
					<button
						class="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/50"
						onclick={() => selectAuthMethod('pin')}
					>
						<div class="flex items-start gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								<KeyRound class="h-5 w-5 text-foreground" />
							</div>
							<div class="flex-1">
								<p class="font-medium">PIN Code</p>
								<p class="text-sm text-muted-foreground">
									Enter a numeric code to unlock your wallet
								</p>
							</div>
						</div>
					</button>

					<!-- WebAuthn Option -->
					{#if securityState.webauthnAvailable}
						<button
							class="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/50"
							onclick={() => selectAuthMethod('webauthn')}
						>
							<div class="flex items-start gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
									<Fingerprint class="h-5 w-5 text-foreground" />
								</div>
								<div class="flex-1">
									<p class="font-medium">Biometrics</p>
									<p class="text-sm text-muted-foreground">
										Use Face ID, Touch ID, or device authenticator
									</p>
								</div>
							</div>
						</button>
					{/if}
				</div>

				<!-- Recovery info styled as a card -->
				<div class="rounded-lg border border-border bg-card p-4">
					<div class="flex items-start gap-3">
						<ShieldCheck class="h-5 w-5 text-muted-foreground" />
						<div>
							<p class="font-medium">Recovery</p>
							<p class="text-sm text-muted-foreground">
								If you lose access, you can recover your wallet using your seed phrase.
							</p>
						</div>
					</div>
				</div>

				<!-- Store insecurely link -->
				<div class="text-center">
					<button
						type="button"
						class="text-sm text-muted-foreground underline hover:text-foreground"
						onclick={() => selectAuthMethod('insecure')}
					>
						Store without security
					</button>
				</div>

			{:else if step === 'pin-enter'}
				<div class="flex flex-col items-center space-y-4">
					<InputOTP
						maxlength={pinLength}
						bind:value={pin}
						pattern={REGEXP_ONLY_DIGITS}
						disabled={isLoading}
						inputmode="numeric"
					>
						{#snippet children({ cells })}
							<InputOTPGroup>
								{#each cells as cell (cell)}
									<InputOTPSlot {cell} />
								{/each}
							</InputOTPGroup>
						{/snippet}
					</InputOTP>

					<!-- Toggle PIN length link -->
					<button
						type="button"
						class="text-sm text-muted-foreground underline hover:text-foreground"
						onclick={togglePinLength}
					>
						{pinLength === 4 ? 'Use 6-digit PIN' : 'Use 4-digit PIN'}
					</button>
				</div>

			{:else if step === 'pin-confirm'}
				<div class="flex flex-col items-center space-y-4">
					<InputOTP
						maxlength={pinLength}
						bind:value={confirmPin}
						pattern={REGEXP_ONLY_DIGITS}
						disabled={isLoading}
						inputmode="numeric"
					>
						{#snippet children({ cells })}
							<InputOTPGroup>
								{#each cells as cell (cell)}
									<InputOTPSlot {cell} />
								{/each}
							</InputOTPGroup>
						{/snippet}
					</InputOTP>

					<p class="text-xs text-muted-foreground">
						Re-enter your PIN to confirm
					</p>
				</div>

			{:else if step === 'webauthn'}
				<div class="flex flex-col items-center space-y-6 py-4">
					<div class="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
						<Fingerprint class="h-10 w-10 text-primary" />
					</div>
					<div class="text-center">
						<p class="text-sm text-muted-foreground">
							Tap the button below to register your biometric authentication.
						</p>
					</div>
				</div>

			{:else if step === 'complete'}
				<div class="flex flex-col items-center space-y-4 py-4">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<Check class="h-8 w-8 text-green-600 dark:text-green-400" />
					</div>
					<p class="text-center text-sm text-muted-foreground">
						{#if authChoice === 'webauthn'}
							Biometric authentication enabled.
						{:else if authChoice === 'insecure'}
							Your wallet has been saved without security.
						{:else}
							Your wallet is now protected with a {pinLength}-digit PIN.
						{/if}
					</p>
				</div>
			{/if}
		</div>

		{#if step !== 'complete' && step !== 'choose'}
			<DialogFooter class="flex-col gap-2 sm:flex-row">
				<Button variant="ghost" onclick={goBack} disabled={isLoading}>
					Back
				</Button>

				{#if step === 'pin-enter'}
					<Button onclick={handlePinEntered} disabled={pin.length !== pinLength || isLoading}>
						Continue
					</Button>
				{:else if step === 'pin-confirm'}
					<Button onclick={handleConfirmPin} disabled={confirmPin.length !== pinLength || isLoading}>
						{#if isLoading}
							<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						Confirm
					</Button>
				{:else if step === 'webauthn'}
					<Button onclick={handleWebAuthnSetup} disabled={isLoading}>
						{#if isLoading}
							<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						Enable Biometrics
					</Button>
				{/if}
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
