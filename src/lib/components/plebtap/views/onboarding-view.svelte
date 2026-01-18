<!-- src/lib/components/plebtap/views/onboarding-view.svelte -->
<script lang="ts">
	import ViewContainer from './view-container.svelte';
	import ViewLayout from './view-layout.svelte';
</script>

<ViewContainer>
	<ViewLayout>
		<div class="flex flex-col items-center justify-center space-y-4">
			<h1 class="text-2xl font-bold">Welcome to Plebtap</h1>
			<p class="text-center text-muted-foreground">
				Your self-custodial Bitcoin wallet powered by Nostr
			</p>
		</div>
	</ViewLayout>
</ViewContainer>
