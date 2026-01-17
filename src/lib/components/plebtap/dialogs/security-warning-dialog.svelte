<!-- src/lib/components/plebtap/dialogs/security-warning-dialog.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';

	// Props
	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		showSetupPIN?: boolean;
		proceedButtonText?: string;
		proceedButtonVariant?: 'default' | 'destructive' | 'outline' | 'ghost';
		onProceed?: () => void;
		onSetupPIN?: () => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		title = 'Security Warning',
		description = 'Your private key is not protected by a PIN. Anyone with access to this device can view and copy your key.',
		showSetupPIN = true,
		proceedButtonText = 'I Understand, Proceed Anyway',
		proceedButtonVariant = 'destructive',
		onProceed,
		onSetupPIN,
		onCancel
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		proceed: void;
		setupPin: void;
		cancel: void;
	}>();

	function handleProceed() {
		dispatch('proceed');
		onProceed?.();
		open = false;
	}

	function handleSetupPIN() {
		dispatch('setupPin');
		onSetupPIN?.();
		open = false;
	}

	function handleCancel() {
		dispatch('cancel');
		onCancel?.();
		open = false;
	}
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleCancel()}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-amber-600">
				<ShieldAlert class="h-5 w-5" />
				{title}
			</DialogTitle>
			<DialogDescription>
				{description}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<Alert variant="destructive">
				<ShieldAlert class="h-4 w-4" />
				<AlertTitle>Unprotected Key</AlertTitle>
				<AlertDescription>
					Without a PIN, your private key can be accessed by anyone who has access to this browser. 
					This includes:
					<ul class="mt-2 list-inside list-disc text-xs">
						<li>Other people using this device</li>
						<li>Browser extensions with storage access</li>
						<li>Malicious software on your computer</li>
					</ul>
				</AlertDescription>
			</Alert>

			{#if showSetupPIN}
				<Alert>
					<ShieldCheck class="h-4 w-4" />
					<AlertTitle>Recommended</AlertTitle>
					<AlertDescription>
						Set up a PIN to encrypt your private key. This only takes a few seconds and significantly improves your security.
					</AlertDescription>
				</Alert>
			{/if}
		</div>

		<DialogFooter class="flex-col gap-2 sm:flex-row">
			{#if showSetupPIN}
				<Button variant="default" onclick={handleSetupPIN} class="order-first sm:order-last">
					<ShieldCheck class="mr-2 h-4 w-4" />
					Set Up PIN
				</Button>
			{/if}
			<Button variant={proceedButtonVariant} onclick={handleProceed}>
				{proceedButtonText}
			</Button>
			<Button variant="ghost" onclick={handleCancel}>
				Cancel
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
