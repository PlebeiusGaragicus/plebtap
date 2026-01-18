<!-- src/lib/components/settings/RelayList.svelte -->
<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { relays, relayConnectionStatus, addRelay } from '$lib/stores/nostr.js';
    import Plus from '@lucide/svelte/icons/plus';
	import RelayListItem from './relay-list-item.svelte';

	let relayUrl = '';

	async function handleAddRelay() {
		if (!relayUrl.trim()) return;
		try {
			await addRelay(relayUrl);
			relayUrl = '';
		} catch (error) {
			console.error('Error adding relay:', error);
			throw error;
		}
	}
</script>

<div class="flex flex-1 flex-col space-y-3">
	<div class="flex items-center justify-between">
		<span class="text-xs font-medium text-muted-foreground">
			Your relays ({$relays.length})
		</span>
	</div>
	
	<!-- Relay list - scrollable if needed -->
	<div class="flex-1 space-y-1 overflow-y-auto">
		{#if $relays.length === 0}
			<div class="py-2 text-center text-xs text-muted-foreground">No relays configured</div>
		{:else}
			{#each $relayConnectionStatus as relay (relay.url)}
				<RelayListItem {relay} />
			{/each}
		{/if}
	</div>
	
	<!-- Add relay input - always visible at bottom -->
	<div class="flex shrink-0 items-center space-x-2 pt-2">
		<Input placeholder="wss://relay.example.com" bind:value={relayUrl} class="flex-1 text-base md:text-xs" />
		<Button size="sm" onclick={handleAddRelay} disabled={!relayUrl.trim()}>
			<Plus />
			Add
		</Button>
	</div>
</div>
