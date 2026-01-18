<!-- src/lib/components/plebtap/views/settings-relay-management-view.svelte -->
<script lang="ts">
	import { navigateTo } from '$lib/stores/navigation.js';

	import Button from '$lib/components/ui/button/button.svelte';
	import ViewContainer from './view-container.svelte';
	import RelayList from '../settings/relay-list.svelte';

	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
</script>

<ViewContainer>
	<div class="flex items-center p-2">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('settings')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Relay Management</h3>
	</div>

	<div class="flex-1 space-y-3 px-4">
		<p class="text-sm text-muted-foreground">
			Relays store your encrypted conversations and wallet data. Adding multiple reliable relays
			improves your experience and helps maintain access to your data across devices.
		</p>
		<RelayList />
	</div>
</ViewContainer>
