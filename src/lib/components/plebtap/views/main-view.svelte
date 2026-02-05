<!-- src/lib/components/plebtap/views/main-view.svelte -->
<script lang="ts">
	import { currentUser } from '$lib/stores/nostr.js';
	import { isLoadingTransactions, walletTransactions, creditBalance, sweepCreditsToWallet } from '$lib/stores/wallet.js';
	import { navigateTo } from '$lib/stores/navigation.js';
	import { toast } from 'svelte-sonner';

	import Button from '$lib/components/ui/button/button.svelte';
	import ViewContainer from './view-container.svelte';
	import ViewLayout from './view-layout.svelte';
	import WalletBalance from '../wallet/wallet-balance.svelte';
	import RecentTransactions from '../wallet/recent-transactions.svelte';

	import ArrowDownRight from '@lucide/svelte/icons/arrow-down-right';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Clock from '@lucide/svelte/icons/clock';
	import Copy from '@lucide/svelte/icons/copy';
	import Settings from '@lucide/svelte/icons/settings';
	import ScanQrCode from '@lucide/svelte/icons/scan-qr-code';
	import Coins from '@lucide/svelte/icons/coins';

	import { copyToClipboard } from '$lib/utils/clipboard.js';
	
	let isSweeping = $state(false);
	
	async function handleSweepCredits() {
		isSweeping = true;
		try {
			const result = await sweepCreditsToWallet();
			toast.success('Credits swept to wallet', {
				description: `+${result.amount} sats added to wallet (${result.fee} sat fee)`
			});
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			toast.error('Sweep failed', { description: msg });
		} finally {
			isSweeping = false;
		}
	}
</script>

<ViewContainer>
	<ViewLayout noPadding>
		{#snippet header()}
			<!-- Top Header with npub and action buttons -->
			<div class="flex shrink-0 items-center justify-between p-2">
				<!-- User npub abbreviated - clickable to copy -->
				<button
					type="button"
					class="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-muted/50 active:bg-muted"
					title="Click to copy npub"
					onclick={() => $currentUser?.npub && copyToClipboard($currentUser.npub, 'npub')}
				>
					<span>{$currentUser?.npub.slice(0, 8)}...{$currentUser?.npub.slice(-4)}</span>
					<Copy class="h-3 w-3 text-muted-foreground/50" />
				</button>
				<!-- Action buttons -->
				<div class="flex space-x-1">
					<Button
						variant="ghost"
						size="icon"
						class="h-8 w-8"
						onclick={() => navigateTo('transaction-history')}
					>
						<Clock class="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => navigateTo('settings')}>
						<Settings class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/snippet}

		<div class="space-y-4 p-4">
			<!-- Wallet Balance Section - Centered and prominent -->
			<div class="flex flex-col items-center py-4">
				<div class="mb-2 text-sm text-muted-foreground">Wallet Balance</div>
				<div class="text-xl font-bold">
					<WalletBalance />
				</div>
			</div>
			
			<!-- PlebChat Credits Section - Shows when credits available -->
			{#if $creditBalance > 0}
				<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Coins class="h-4 w-4 text-amber-500" />
							<div>
								<div class="text-sm font-medium">PlebChat Credits</div>
								<div class="text-xs text-muted-foreground">
									{$creditBalance} sats (no-fee payments)
								</div>
							</div>
						</div>
						<Button 
							variant="outline" 
							size="sm"
							onclick={handleSweepCredits}
							disabled={isSweeping}
						>
							{isSweeping ? 'Sweeping...' : 'Sweep to Wallet'}
						</Button>
					</div>
					<div class="mt-2 text-xs text-muted-foreground">
						Credits are used automatically for payments. Sweep to convert to wallet sats (1 sat fee).
					</div>
				</div>
			{/if}

			<!-- Single row with Receive, Scan, and Send buttons -->
			<div class="flex items-center justify-center gap-2">
				<!-- Receive button (fills left side) -->
				<Button
					variant="outline"
					onclick={() => navigateTo('receive')}
					class="flex-1 items-center justify-center"
				>
					<ArrowDownRight class="mr-2 h-4 w-4" />
					Receive
				</Button>
				<!-- Scan button (centered, square) -->
				<Button variant="default" size="icon" onclick={() => navigateTo('qr-scanner')}>
					<ScanQrCode />
				</Button>
				<!-- Send button (fills right side) -->
				<Button
					variant="outline"
					onclick={() => navigateTo('send')}
					class="flex-1 items-center justify-center"
				>
					<ArrowUpRight class="mr-2 h-4 w-4" />
					Send
				</Button>
			</div>

			<!-- Recent Transactions Section -->
			{#if $walletTransactions.length > 0 || $isLoadingTransactions}
				<div class="mt-2 rounded-lg bg-secondary/20 p-3">
					<RecentTransactions limit={3} />
				</div>
			{/if}

			<!-- Footer warning text -->
			<div class="mt-6 border-t pt-2 text-center text-xs text-muted-foreground">
				<p>
					PlebTap is <a
						href="https://github.com/PlebeiusGaragicus/plebtap"
						target="_blank"
						class="inline text-blue-500 underline">open source</a
					> and experimental.
				</p>
				<p>Use at your own risk.</p>
			</div>
		</div>
	</ViewLayout>
</ViewContainer>
