<!-- src/lib/components/plebtap/dialogs/unlock-dialog.svelte -->
<!-- Unified unlock dialog: Shows PIN or WebAuthn based on configured auth method -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
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
	import Lock from '@lucide/svelte/icons/lock';
	import Fingerprint from '@lucide/svelte/icons/fingerprint';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	import { securityState, unlockWithPIN, unlockWithWebAuthn, unlockInsecure } from '$lib/stores/security.svelte.js';
	import type { UnlockResult } from '$lib/types/security.js';

	// Props
	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		onSuccess?: (result: UnlockResult) => void;
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

	const dispatch = createEventDispatcher<{
		success: UnlockResult;
		cancel: void;
	}>();

	// Determine what auth method to show
	const authMethod = $derived(securityState.authMethod);
	const pinLength = $derived(securityState.pinLength);

	// Reset state when dialog opens
	$effect(() => {
		if (open) {
			pin = '';
			errorMessage = '';
			isLoading = false;
			attemptCount = 0;
			
			// Auto-trigger WebAuthn if that's the configured method
			if (authMethod === 'webauthn') {
				// Small delay to let dialog render
				setTimeout(() => handleWebAuthn(), 100);
			}
			
			// Auto-unlock for insecure storage
			if (authMethod === 'none' && securityState.hasStoredKey) {
				setTimeout(() => handleInsecureUnlock(), 100);
			}
		}
	});

	async function handleInsecureUnlock() {
		isLoading = true;
		errorMessage = '';

		try {
			const result = await unlockInsecure();

			if (result.success) {
				dispatch('success', result);
				onSuccess?.(result);
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
		if (pin.length !== pinLength) {
			errorMessage = `Please enter your ${pinLength}-digit PIN`;
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			const result = await unlockWithPIN(pin);

			if (result.success) {
				dispatch('success', result);
				onSuccess?.(result);
				open = false;
			} else {
				errorMessage = result.error || 'Incorrect PIN';
				attemptCount++;
				pin = '';
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred';
			pin = '';
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
				dispatch('success', result);
				onSuccess?.(result);
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
		dispatch('cancel');
		onCancel?.();
		open = false;
	}

	// Auto-submit when PIN is complete
	$effect(() => {
		if (authMethod === 'pin' && pin.length === pinLength && !isLoading) {
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
				<div class="flex flex-col items-center space-y-4">
					<InputOTP
						maxlength={pinLength}
						bind:value={pin}
						pattern={REGEXP_ONLY_DIGITS}
						disabled={isLoading}
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
			
			{#if authMethod === 'pin'}
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
