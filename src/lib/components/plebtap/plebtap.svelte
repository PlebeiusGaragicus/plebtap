<!-- src/lib/components/plebtap/plebtap.svelte -->
<script lang="ts">
	import {
		initNavigation,
		isUserMenuOpen,
		openMenu,
		navigateTo,
	} from '$lib/stores/navigation.js';
	import { MediaQuery } from 'svelte/reactivity';
	import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover/index.js';
	import ViewRouter from './views/view-router.svelte';
	import PlebtapTrigger from './plebtap-trigger.svelte';

	import { MobileSheet, MobileSheetTrigger, MobileSheetContent } from '$lib/components/ui/mobile-sheet/index.js';
	import { onMount } from 'svelte';
	import { autoLogin, loginWithDecryptedKey } from '$lib/stores/nostr.js';
	import { securityState } from '$lib/stores/security.svelte.js';
	import { UnlockDialog } from './dialogs/index.js';
	import { initWallet } from '$lib/stores/wallet.js';

	const isDesktop = new MediaQuery('(min-width: 768px)').current;

	// Unlock dialog state
	let showUnlockDialog = $state(false);
	let autoLoginError = $state<string | null>(null);

	// Reactive check for locked state - directly access securityState for reactivity
	let locked = $derived(
		securityState.hasStoredKey &&
		securityState.authMethod !== 'none' &&
		!securityState.isUnlocked
	);

	// When popover opens, reset current view
	$effect(() => {
		if ($isUserMenuOpen) {
			initNavigation();
			openMenu();
		}
	});

	// Try auto login
	onMount(async () => {
		const result = await autoLogin();

		if (result.status === 'needs_unlock') {
			// Don't show dialog immediately - wait for user to click the locked button
		} else if (result.status === 'error') {
			autoLoginError = result.error;
		}
	});

	async function handleUnlockSuccess(result: { key?: { nsec: string } }) {
		if (result.key?.nsec) {
			try {
				await loginWithDecryptedKey(result.key.nsec);
				// Initialize wallet after successful unlock
				await initWallet();
				// Navigate to main view after successful unlock
				navigateTo('main');
			} catch (error) {
				autoLoginError = error instanceof Error ? error.message : 'Login failed';
			}
		}
	}

	function handleTriggerClick() {
		// Show unlock dialog (only called when locked)
		showUnlockDialog = true;
	}
</script>

{#if isDesktop}
	<div class="relative">
		{#if locked}
			<!-- When locked, just show the trigger with click handler for unlock dialog -->
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div onclick={handleTriggerClick} class="cursor-pointer">
				<PlebtapTrigger />
			</div>
		{:else}
			<Popover bind:open={$isUserMenuOpen}>
				<PopoverTrigger>
					<PlebtapTrigger />
				</PopoverTrigger>
				<PopoverContent align="end" class="h-[420px] w-80 overflow-hidden p-0">
					<ViewRouter />
				</PopoverContent>
			</Popover>
		{/if}
	</div>
{:else}
	{#if locked}
		<!-- When locked, just show the trigger with click handler for unlock dialog -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div onclick={handleTriggerClick} class="cursor-pointer">
			<PlebtapTrigger />
		</div>
	{:else}
		<!-- Mobile: Full-screen sheet -->
		<MobileSheet bind:open={$isUserMenuOpen}>
			<MobileSheetTrigger>
				<PlebtapTrigger />
			</MobileSheetTrigger>
			<MobileSheetContent showCloseButton={true}>
				<ViewRouter />
			</MobileSheetContent>
		</MobileSheet>
	{/if}
{/if}

<!-- Unlock Dialog for locked wallet -->
<UnlockDialog
	bind:open={showUnlockDialog}
	title="Unlock Wallet"
	description="Enter your PIN to unlock your wallet"
	onSuccess={handleUnlockSuccess}
/>
