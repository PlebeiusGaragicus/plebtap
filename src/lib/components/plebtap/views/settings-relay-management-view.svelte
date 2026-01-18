<!-- src/lib/components/plebtap/views/settings-relay-management-view.svelte -->
<script lang="ts">
	import { navigateTo } from '$lib/stores/navigation.js';

	import Button from '$lib/components/ui/button/button.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import ViewContainer from './view-container.svelte';
	import RelayList from '../settings/relay-list.svelte';

	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
</script>

<ViewContainer className="p-0 max-h-[55svh] md:max-h-[60svh]">
	<div class="mb-2 flex items-center p-2">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('settings')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Relay Management</h3>
	</div>

	<ScrollArea class="p-2">
		<div class="max-h-[60svh] px-2 md:max-h-[50svh]">
			<div class="space-y-3">
				<p class="text-sm text-muted-foreground">
					Relays store your encrypted conversations and wallet data. Adding multiple reliable relays
					improves your experience and helps maintain access to your data across devices.
				</p>
				<RelayList />
			</div>
		</div>
	</ScrollArea>
</ViewContainer>
