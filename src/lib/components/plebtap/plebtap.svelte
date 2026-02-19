<!-- src/lib/components/plebtap/plebtap.svelte -->
<script lang="ts">
	import {
		isUserMenuOpen,
		openMenu,
		navigateTo,
	} from '$lib/stores/navigation.js';
	import { MediaQuery } from 'svelte/reactivity';
	import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover/index.js';
	import ViewRouter from './views/view-router.svelte';
	import PlebtapTrigger from './plebtap-trigger.svelte';

	import { Drawer, DrawerTrigger, DrawerContent } from '$lib/components/ui/drawer/index.js';
	import { onMount } from 'svelte';
	import { autoLogin, loginWithDecryptedKey } from '$lib/stores/nostr.js';
	import { securityState } from '$lib/stores/security.svelte.js';
	import { UnlockDialog } from './dialogs/index.js';
	import { initWallet } from '$lib/stores/wallet.js';

	const desktopQuery = new MediaQuery('(min-width: 768px)');
	let isDesktop = $derived(desktopQuery.current);

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
				await initWallet();
				navigateTo('main');
			} catch (error) {
				autoLoginError = error instanceof Error ? error.message : 'Login failed';
			}
		}
	}

	function handleTriggerClick() {
		showUnlockDialog = true;
	}
</script>

{#if isDesktop}
	<div class="relative">
		{#if locked}
			<button
				type="button"
				onclick={handleTriggerClick}
				class="cursor-pointer appearance-none border-0 bg-transparent p-0"
			>
				<PlebtapTrigger />
			</button>
		{:else}
			<Popover bind:open={$isUserMenuOpen}>
				<PopoverTrigger>
					<PlebtapTrigger />
				</PopoverTrigger>
				<PopoverContent align="end" class="h-[min(80vh,600px)] w-[360px] overflow-y-auto p-0">
					<ViewRouter />
				</PopoverContent>
			</Popover>
		{/if}
	</div>
{:else}
	{#if locked}
		<button
			type="button"
			onclick={handleTriggerClick}
			class="cursor-pointer appearance-none border-0 bg-transparent p-0"
		>
			<PlebtapTrigger />
		</button>
	{:else}
		<Drawer bind:open={$isUserMenuOpen}>
			<DrawerTrigger>
				<PlebtapTrigger />
			</DrawerTrigger>
			<DrawerContent class="h-[90dvh]">
				<ViewRouter />
			</DrawerContent>
		</Drawer>
	{/if}
{/if}

<UnlockDialog
	bind:open={showUnlockDialog}
	title="Unlock Wallet"
	description="Enter your PIN to unlock your wallet"
	onSuccess={handleUnlockSuccess}
/>
