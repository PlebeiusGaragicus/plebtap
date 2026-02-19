<!-- src/lib/components/wallet/WalletBalance.svelte -->
<script lang="ts">
	import { walletBalance, isWalletReady, creditBalance } from '$lib/stores/wallet.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	interface Props {
		compact?: boolean;
		showCredits?: boolean;
	}

	let { compact = false, showCredits = true }: Props = $props();

	let totalBalance = $derived($walletBalance + $creditBalance);
	let hasCredits = $derived($creditBalance > 0);
</script>

<div class={compact ? 'text-sm text-muted-foreground' : 'text-3xl font-bold'}>
	{#if $isWalletReady}
		{#if showCredits && hasCredits}
			<!-- Show total with breakdown -->
			<div class="flex flex-col">
				<span>{totalBalance.toLocaleString()} sats</span>
				<span class="text-xs text-muted-foreground font-normal">
					({$walletBalance.toLocaleString()} wallet + {$creditBalance.toLocaleString()} credits)
				</span>
			</div>
		{:else}
			{$walletBalance.toLocaleString()} sats
		{/if}
	{:else}
		<div class="flex items-center gap-2">
			<LoaderCircle class="h-4 w-4 animate-spin" />
			<span class="text-sm text-muted-foreground">Loading...</span>
		</div>
	{/if}
</div>
