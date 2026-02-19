<!-- src/lib/components/plebtap/views/transaction-history-view.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { navigateTo } from '$lib/stores/navigation.js';
	import { formatTransactionDescription } from '$lib/utils/tx.js';
	import {
		walletTransactions,
		isLoadingTransactions,
		wallet,
		formatTransaction,
		loadTransactionHistory
	} from '$lib/stores/wallet.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import ViewContainer from './view-container.svelte';
	import ViewLayout from './view-layout.svelte';

	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';

	// Local state
	let refreshing = false;
	let retryCount = 0;
	const MAX_RETRIES = 3;

	onMount(() => {
		// If transactions are empty, try to load them on component mount
		if ($walletTransactions.length === 0 && $wallet) {
			loadTransactionHistory();
		}
	});

	async function handleRefresh() {
		if (!$wallet || !$wallet.ndk) return;

		try {
			refreshing = true;
			await loadTransactionHistory();
			retryCount = 0; // Reset retry count on successful load
		} catch (error) {
			console.error('Failed to refresh transactions:', error);
			if (retryCount < MAX_RETRIES) {
				retryCount++;
				setTimeout(() => handleRefresh(), 5000); // Retry after 5 seconds
			}
		} finally {
			refreshing = false;
		}
	}

	// Format the timestamp for display
	function formatTime(timestamp: number): string {
		if (!timestamp) return 'Unknown time';

		try {
			return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
		} catch (error) {
			return 'Invalid time';
		}
	}
</script>

<ViewContainer>
	<ViewLayout title="Transaction History" backTo="main" noPadding>
		{#snippet header()}
			<div class="flex shrink-0 items-center justify-between p-2">
				<div class="flex items-center gap-2">
					<Button variant="ghost" size="icon" onclick={() => navigateTo('main')}>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
					</Button>
					<h3 class="text-lg font-medium">Transaction History</h3>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onclick={handleRefresh}
					disabled={$isLoadingTransactions || refreshing}
					aria-label="Refresh transaction history"
				>
					<RefreshCw class={`h-4 w-4 ${$isLoadingTransactions || refreshing ? 'animate-spin' : ''}`} />
				</Button>
			</div>
		{/snippet}

		<div class="space-y-1 px-4">
			{#if $isLoadingTransactions}
				<div class="flex items-center justify-center py-8">
					<LoaderCircle class="h-6 w-6 animate-spin text-primary" />
				</div>
			{:else if $walletTransactions.length === 0}
				<div class="py-8 text-center text-muted-foreground">
					<p>No transactions yet</p>
					<p class="mt-1 text-sm">Send or receive sats to get started</p>
				</div>
			{:else}
				{#each $walletTransactions as tx}
					{#if tx}
						{@const formattedTx = formatTransaction(tx)}
						{@const displayDescription = formatTransactionDescription(formattedTx.description)}
						<button
							class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
							onclick={() => navigateTo('transaction-details', { tx })}
						>
							<div class="flex items-center">
								<div
									class={`mr-3 flex h-8 w-8 items-center justify-center rounded-full ${formattedTx.direction === 'in' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}
								>
									{#if formattedTx.direction === 'in'}
										<ArrowDownLeft class="h-4 w-4" />
									{:else}
										<ArrowUpRight class="h-4 w-4" />
									{/if}
								</div>
								<div class="text-left">
									<p class="font-medium">
										{displayDescription.length > 25
											? displayDescription.substring(0, 25) + '...'
											: displayDescription}
									</p>
									<p class="text-xs text-muted-foreground">{formatTime(formattedTx.timestamp)}</p>
								</div>
							</div>
							<div class="text-right">
								<p
									class={`font-semibold ${formattedTx.direction === 'in' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}
								>
									{formattedTx.direction === 'in' ? '+' : '-'}{formattedTx.amount} sats
								</p>
								{#if formattedTx.fee > 0}
									<p class="text-xs text-muted-foreground">Fee: {formattedTx.fee} sats</p>
								{/if}
							</div>
						</button>
					{/if}
				{/each}
			{/if}
		</div>
	</ViewLayout>
</ViewContainer>
