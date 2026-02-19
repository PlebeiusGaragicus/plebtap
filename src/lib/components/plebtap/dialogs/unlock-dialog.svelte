<!-- src/lib/components/plebtap/dialogs/unlock-dialog.svelte -->
<!-- Unified unlock dialog: Shows PIN or WebAuthn based on configured auth method -->
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
	import { Button } from '$lib/components/ui/button/index.js';
	import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Lock from '@lucide/svelte/icons/lock';
	import Fingerprint from '@lucide/svelte/icons/fingerprint';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	import { securityState, unlockWithPIN, unlockWithWebAuthn, unlockInsecure, getRateLimitStatus } from '$lib/stores/security.svelte.js';
	import type { UnlockResult } from '$lib/types/security.js';
	import { PIN_RATE_LIMIT } from '$lib/types/security.js';

	// Props
	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		onSuccess?: (result: UnlockResult) => void | Promise<void>;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		title = 'Unlock Wallet',
		description = 'Authenticate to access your wallet',
		onSuccess,
		onCancel
	}: Props = $props();

	// State
	let pin = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let attemptCount = $state(0);
	let attemptsRemaining = $state(PIN_RATE_LIMIT.maxAttempts);
	let isLockedOut = $state(false);
	let lockoutSecondsRemaining = $state(0);
	let lockoutIntervalId: ReturnType<typeof setInterval> | null = null;
	let pinInputContainer: HTMLDivElement | null = $state(null);

	// Determine what auth method to show
	const authMethod = $derived(securityState.authMethod);
	const pinLength = $derived(securityState.pinLength);
	
	// Focus the first PIN input slot
	function focusPinInput() {
		setTimeout(() => {
			const firstInput = pinInputContainer?.querySelector('input');
			firstInput?.focus();
		}, 50);
	}

	// Check and update rate limit status
	async function checkRateLimitStatus(showWarningIfFailed = false) {
		const status = await getRateLimitStatus();
		attemptsRemaining = status.attemptsRemaining;
		isLockedOut = status.limited;
		
		if (status.limited && status.waitTime) {
			lockoutSecondsRemaining = Math.ceil(status.waitTime / 1000);
			startLockoutCountdown();
		} else if (showWarningIfFailed && status.failedAttempts > 0) {
			// Show warning about remaining attempts if there were previous failures
			errorMessage = `${status.attemptsRemaining} attempt${status.attemptsRemaining !== 1 ? 's' : ''} remaining before lockout.`;
		}
	}
	
	function startLockoutCountdown() {
		if (lockoutIntervalId) clearInterval(lockoutIntervalId);
		
		lockoutIntervalId = setInterval(() => {
			lockoutSecondsRemaining--;
			if (lockoutSecondsRemaining <= 0) {
				isLockedOut = false;
				if (lockoutIntervalId) clearInterval(lockoutIntervalId);
				checkRateLimitStatus(); // Refresh status
			}
		}, 1000);
	}
	
	function cleanupLockoutInterval() {
		if (lockoutIntervalId) {
			clearInterval(lockoutIntervalId);
			lockoutIntervalId = null;
		}
	}

	// Reset state when dialog opens
	$effect(() => {
		if (open) {
			pin = '';
			errorMessage = '';
			isLoading = false;
			attemptCount = 0;
			
			// Check rate limit status and show warning if there were previous failed attempts
			checkRateLimitStatus(true);
			
			if (authMethod === 'webauthn') {
				setTimeout(() => handleWebAuthn(), 100);
			} else if (authMethod === 'pin') {
				setTimeout(() => focusPinInput(), 150);
			}
			
			if (authMethod === 'none' && securityState.hasStoredKey) {
				setTimeout(() => handleInsecureUnlock(), 100);
			}
		} else {
			// Cleanup when dialog closes
			cleanupLockoutInterval();
		}
	});

	async function handleInsecureUnlock() {
		isLoading = true;
		errorMessage = '';

		try {
			const result = await unlockInsecure();

			if (result.success) {
				await onSuccess?.(result);
				open = false;
			} else {
				errorMessage = result.error || 'Failed to unlock';
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred';
		} finally {
			isLoading = false;
		}
	}

	async function handlePINSubmit() {
		// Check if locked out
		if (isLockedOut) {
			errorMessage = `Too many failed attempts. Try again in ${lockoutSecondsRemaining} seconds.`;
			return;
		}
		
		if (pin.length !== pinLength) {
			errorMessage = `Please enter your ${pinLength}-digit PIN`;
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			const result = await unlockWithPIN(pin);

			if (result.success) {
				await onSuccess?.(result);
				open = false;
			} else {
				await checkRateLimitStatus();
				
				if (isLockedOut) {
					errorMessage = `Too many failed attempts. Try again in ${lockoutSecondsRemaining} seconds.`;
				} else {
					errorMessage = `Incorrect PIN. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`;
				}
				attemptCount++;
				pin = '';
				focusPinInput();
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred';
			pin = '';
			focusPinInput();
		} finally {
			isLoading = false;
		}
	}

	async function handleWebAuthn() {
		isLoading = true;
		errorMessage = '';

		try {
			const result = await unlockWithWebAuthn();

			if (result.success) {
				await onSuccess?.(result);
				open = false;
			} else {
				errorMessage = result.error || 'Biometric verification failed';
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred';
		} finally {
			isLoading = false;
		}
	}

	function handleCancel() {
		onCancel?.();
		open = false;
	}

	// Auto-submit when PIN is complete
	$effect(() => {
		if (authMethod === 'pin' && pin.length === pinLength && !isLoading && !isLockedOut) {
			handlePINSubmit();
		}
	});
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleCancel()}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				{#if authMethod === 'webauthn'}
					<Fingerprint class="h-5 w-5" />
				{:else}
					<Lock class="h-5 w-5" />
				{/if}
				{title}
			</DialogTitle>
			<DialogDescription>
				{description}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			{#if errorMessage}
				<Alert variant="destructive">
					<CircleAlert class="h-4 w-4" />
					<AlertDescription>{errorMessage}</AlertDescription>
				</Alert>
			{/if}

			{#if authMethod === 'webauthn'}
				<!-- WebAuthn UI -->
				<div class="flex flex-col items-center space-y-6 py-4">
					<div class="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
						<Fingerprint class="h-10 w-10 text-primary" />
					</div>
					
					{#if isLoading}
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							<LoaderCircle class="h-4 w-4 animate-spin" />
							Waiting for authentication...
						</div>
					{:else}
						<Button onclick={handleWebAuthn} class="w-full">
							<Fingerprint class="mr-2 h-4 w-4" />
							Use Biometrics
						</Button>
					{/if}
				</div>

			{:else if authMethod === 'pin'}
				<!-- PIN UI -->
				<div class="flex flex-col items-center space-y-4" bind:this={pinInputContainer}>
					{#if isLockedOut}
						<!-- Lockout display -->
						<div class="flex flex-col items-center space-y-3 py-4">
							<div class="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
								<Lock class="h-8 w-8 text-destructive" />
							</div>
							<p class="text-sm font-medium text-destructive">Too many failed attempts</p>
							<p class="text-2xl font-mono font-bold">{Math.floor(lockoutSecondsRemaining / 60)}:{(lockoutSecondsRemaining % 60).toString().padStart(2, '0')}</p>
							<p class="text-xs text-muted-foreground">Try again after the countdown</p>
						</div>
					{:else}
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

						<p class="text-xs text-muted-foreground">
							Enter your {pinLength}-digit PIN
						</p>
					{/if}
				</div>

			{:else if authMethod === 'none' && securityState.hasStoredKey}
				<!-- Insecure storage - auto-unlocking -->
				<div class="flex flex-col items-center space-y-4 py-4">
					{#if isLoading}
						<LoaderCircle class="h-8 w-8 animate-spin text-primary" />
						<p class="text-sm text-muted-foreground">Unlocking...</p>
					{:else}
						<Button onclick={handleInsecureUnlock} class="w-full">
							Continue
						</Button>
					{/if}
				</div>

			{:else}
				<!-- No auth method configured -->
				<div class="py-4 text-center">
					<p class="text-sm text-muted-foreground">
						No authentication method is configured.
					</p>
				</div>
			{/if}
		</div>

		<DialogFooter class="flex-col gap-2 sm:flex-row">
			<Button variant="ghost" onclick={handleCancel} disabled={isLoading}>
				Cancel
			</Button>
			
			{#if authMethod === 'pin' && !isLockedOut}
				<Button onclick={handlePINSubmit} disabled={pin.length !== pinLength || isLoading}>
					{#if isLoading}
						<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Unlock
				</Button>
			{/if}
		</DialogFooter>
	</DialogContent>
</Dialog>
