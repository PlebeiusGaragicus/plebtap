<!-- src/lib/components/plebtap/views/settings-mint-management-view.svelte -->
<script lang="ts">
	import { navigateTo } from '$lib/stores/navigation.js';
	import { consolidateTokens } from '$lib/stores/wallet.js';

	import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import ViewContainer from './view-container.svelte';
	import MintList from '../settings/mint-list.svelte';

	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';

	// Simple state for the consolidation process
	let isConsolidating: boolean = false;
	let consolidateError: string | null = '';

	async function handleConsolidate() {
		try {
			// Reset state
			isConsolidating = true;
			consolidateError = '';

			// Call the consolidateTokens function
			await consolidateTokens();
		} catch (error) {
			consolidateError =
				error instanceof Error ? error.message : 'Failed to consolidate your tokens.';
		} finally {
			isConsolidating = false;
		}
	}
</script>

<ViewContainer className="p-0 max-h-[55dvh] md:max-h-[60dvh]">
	<div class="mb-2 flex items-center p-2">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('settings')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Mint Management</h3>
	</div>

	<ScrollArea class="p-2">
		<div class="max-h-[60dvh] px-2 md:max-h-[50dvh]">
			<div class="space-y-3">
				<p class="text-sm text-muted-foreground">
					Mints are servers that issue ecash tokens. Add trusted mints to send, receive, and manage
					your Cashu tokens.
				</p>
				<MintList />
				<Separator />
				<p class="text-sm text-muted-foreground">
					Consolidation combines your tokens and removes spent ones for better wallet performance.
				</p>

				<!-- Simple consolidation button with minimal feedback -->
				<Button
					disabled={isConsolidating}
					variant="outline"
					class="w-full"
					onclick={handleConsolidate}
				>
					<RefreshCw class={isConsolidating ? 'mr-2 animate-spin' : 'mr-2'} />
					{isConsolidating ? 'Consolidating tokens...' : 'Consolidate Tokens'}
				</Button>

				<!-- Error message -->
				{#if consolidateError}
					<Alert class="mt-2 border-red-200 bg-red-50">
						<AlertDescription class="text-red-700">
							{consolidateError}
						</AlertDescription>
					</Alert>
				{/if}
			</div>
		</div>
	</ScrollArea>
</ViewContainer>
