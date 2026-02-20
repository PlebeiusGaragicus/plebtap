<!-- src/lib/components/plebtap/views/view-router.svelte -->
<!-- Simplified view router - container (Popover/MobileSheet) handles constraints -->
<script lang="ts">
	import { currentView, initNavigation } from '$lib/stores/navigation.js';
	import { loadNegentropy } from '$lib/utils/negentropy.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	import OnboardingView from './onboarding-view.svelte';
	import LoginView from './login-view.svelte';
	import MainView from './main-view.svelte';

	initNavigation();
	loadNegentropy();
</script>

{#snippet viewLoading()}
	<div class="flex h-full items-center justify-center">
		<LoaderCircle class="h-6 w-6 animate-spin text-muted-foreground" />
	</div>
{/snippet}

<div class="relative h-full w-full overflow-hidden">
	{#if $currentView === 'onboarding'}
		<OnboardingView />
	{:else if $currentView === 'login'}
		<LoginView />
	{:else if $currentView === 'main'}
		<MainView />
	{:else if $currentView === 'login-private-key'}
		{#await import('./login-nsec-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'login-import-mnemonic'}
		{#await import('./login-import-mnemonic-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'login-link-device'}
		{#await import('./login-link-device-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'login-nip-07'}
		{#await import('./login-nip-07-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'login-generate-key'}
		{#await import('./login-generate-key-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'receive'}
		{#await import('./receive-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'send'}
		{#await import('./send-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'transaction-history'}
		{#await import('./transaction-history-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'transaction-details'}
		{#await import('./transaction-details-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'settings'}
		{#await import('./settings-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'settings-link-device'}
		{#await import('./settings-link-device-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'settings-wallet-sync'}
		{#await import('./settings-wallet-sync-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'settings-mint-management'}
		{#await import('./settings-mint-management-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'settings-relay-management'}
		{#await import('./settings-relay-management-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'settings-nostr-keys'}
		{#await import('./settings-nostr-keys-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'settings-sign-out'}
		{#await import('./settings-sign-out-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{:else if $currentView === 'qr-scanner'}
		{#await import('./scanner-view.svelte')}
			{@render viewLoading()}
		{:then { default: Component }}
			<Component />
		{/await}
	{/if}
</div>
