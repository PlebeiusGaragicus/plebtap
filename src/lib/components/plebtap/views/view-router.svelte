<!-- src/lib/components/plebtap/views/view-router.svelte -->
<script lang="ts">
	import { currentView, initNavigation, inTransition } from '$lib/stores/navigation.js';
	import { MediaQuery } from 'svelte/reactivity';
	import LoginGenerateKeyView from './login-generate-key-view.svelte';
	import LoginImportMnemonicView from './login-import-mnemonic-view.svelte';
	import LoginLinkDeviceView from './login-link-device-view.svelte';
	import LoginNip_07View from './login-nip-07-view.svelte';
	import LoginNsecView from './login-nsec-view.svelte';
	import LoginView from './login-view.svelte';
	import MainView from './main-view.svelte';
	import ReceiveView from './receive-view.svelte';
	import ScannerView from './scanner-view.svelte';
	import SendView from './send-view.svelte';
	import SettingsView from './settings-view.svelte';
	import SettingsLinkDeviceView from './settings-link-device-view.svelte';
	import SettingsWalletSyncView from './settings-wallet-sync-view.svelte';
	import SettingsMintManagementView from './settings-mint-management-view.svelte';
	import SettingsRelayManagementView from './settings-relay-management-view.svelte';
	import SettingsNostrKeysView from './settings-nostr-keys-view.svelte';
	import SettingsSignOutView from './settings-sign-out-view.svelte';
	import TransactionDetailsView from './transaction-details-view.svelte';
	import TransactionHistoryView from './transaction-history-view.svelte';
	import OnboardingView from './onboarding-view.svelte';
	import { loadNegentropy } from '$lib/utils/negentropy.js';
	
	export let isDesktop = new MediaQuery('(min-width: 768px)').current;
	export let fullScreen = false;


	initNavigation();
	loadNegentropy();

	// Component mapping
	const viewComponents = {
		'onboarding': OnboardingView,
		'login': LoginView,
		'login-private-key': LoginNsecView,
		'login-import-mnemonic': LoginImportMnemonicView,
		'login-link-device': LoginLinkDeviceView,
		'login-nip-07': LoginNip_07View,
		'login-generate-key': LoginGenerateKeyView,
		'main': MainView,
		'receive': ReceiveView,
		'send': SendView,
		'transaction-history': TransactionHistoryView,
		'transaction-details': TransactionDetailsView,
		'settings': SettingsView,
		'settings-link-device': SettingsLinkDeviceView,
		'settings-wallet-sync': SettingsWalletSyncView,
		'settings-mint-management': SettingsMintManagementView,
		'settings-relay-management': SettingsRelayManagementView,
		'settings-nostr-keys': SettingsNostrKeysView,
		'settings-sign-out': SettingsSignOutView,
		'qr-scanner': ScannerView
	};
</script>

<!-- Different wrapper based on container type -->
{#if isDesktop}
	<!-- For popover: original adaptive height behavior -->
	<div class={`min-h-32 border border-yellow-500 ${$inTransition ? 'relative' : 'h-full '}`}>
		{#each Object.entries(viewComponents) as [name, Component]}
			{#if $currentView === name}
				<div class={$inTransition ? 'absolute inset-0' : ''}>
					<svelte:component this={Component} />
				</div>
			{/if}
		{/each}
	</div>
{:else if fullScreen}
<!-- wallet mode -->
	<div class="flex  max-h-full justify-center overflow-y-auto border">
		<div class="mx-auto w-full max-w-md">
			<div class={$inTransition ? 'relative' : 'h-full'}>
				{#each Object.entries(viewComponents) as [name, Component]}
					{#if $currentView === name}
						<!-- Fixed top position when in drawer -->
						<div class={$inTransition ? 'absolute inset-0' : ''}>
							<svelte:component this={Component} />
						</div>
					{/if}
				{/each}
			</div>
		</div>
	</div>
{:else} 
<!-- Mobile Sheet - full screen, safe areas handled by MobileSheetContent -->
	<div class="mx-auto flex h-full w-full max-w-md flex-col">
		<div class={$inTransition ? 'relative flex-1' : 'flex flex-1 flex-col'}>
			{#each Object.entries(viewComponents) as [name, Component]}
				{#if $currentView === name}
					<div class={$inTransition ? 'absolute inset-0' : 'flex flex-1 flex-col'}>
						<svelte:component this={Component} />
					</div>
				{/if}
			{/each}
		</div>
	</div>
{/if}
