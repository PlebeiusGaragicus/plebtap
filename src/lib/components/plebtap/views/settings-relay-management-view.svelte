<!-- src/lib/components/plebtap/views/settings-relay-management-view.svelte -->
<script lang="ts">
	import ViewContainer from './view-container.svelte';
	import ViewLayout from './view-layout.svelte';
	import RelayList from '../settings/relay-list.svelte';
</script>

<ViewContainer>
	<ViewLayout title="Relay Management" backTo="settings" contentClass="flex flex-col">
		<p class="shrink-0 text-sm text-muted-foreground">
			Relays store your encrypted conversations and wallet data. Adding multiple reliable relays
			improves your experience and helps maintain access to your data across devices.
		</p>
		<div class="mt-3 flex-1">
			<RelayList />
		</div>
	</ViewLayout>
</ViewContainer>
