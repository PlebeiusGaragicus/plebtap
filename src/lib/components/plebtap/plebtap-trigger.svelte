<script lang="ts">
	import LogIn from '@lucide/svelte/icons/log-in';
	import Wallet from '@lucide/svelte/icons/wallet';
	import Lock from '@lucide/svelte/icons/lock';
	import Button from '../ui/button/button.svelte';
	import Skeleton from '../ui/skeleton/skeleton.svelte';
	import { isWalletReady, walletBalance } from '$lib/stores/wallet.js';
	import { isLoggedIn, isConnecting } from '$lib/stores/nostr.js';
	import { securityState } from '$lib/stores/security.svelte.js';

	// Format balance for display
	function formatBalance(balance: number): string {
		return balance.toLocaleString();
	}
	
	// Reactive check for locked state - directly access securityState for reactivity
	let locked = $derived(
		securityState.hasStoredKey &&
		securityState.authMethod !== 'none' &&
		!securityState.isUnlocked
	);
</script>

{#if securityState.isInitializing}
	<!-- Loading state while initializing security -->
	<Button variant="default" disabled>
		<Wallet class="h-5 w-5" />
		<Skeleton class="h-4 w-16" />
	</Button>
{:else if locked}
	<!-- Locked state - has secured key but not unlocked -->
	<Button variant="default">
		<Lock class="h-5 w-5" />
		<span class="font-medium">Locked</span>
	</Button>
{:else if $isLoggedIn}
	<Button variant="default">
		<!-- Wallet Balance Display -->
		<Wallet class="h-5 w-5" />
		{#if $isWalletReady}
			<span class="font-medium">{formatBalance($walletBalance)} sats</span>
		{:else}
			<Skeleton class="h-4 w-16" />
		{/if}
	</Button>
{:else}
	<Button variant="default" size="sm" disabled={$isConnecting}>
		{#if $isConnecting}
			<span
				class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
			></span>
			Connecting...
		{:else}
			<LogIn class="mr-2 h-4 w-4" />
			Start
		{/if}
	</Button>
{/if}
