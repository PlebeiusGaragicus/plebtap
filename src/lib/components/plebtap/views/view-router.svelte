<!-- src/lib/components/plebtap/views/view-router.svelte -->
<!-- Simplified view router - container (Popover/MobileSheet) handles constraints -->
<script lang="ts">
	import { currentView, initNavigation } from '$lib/stores/navigation.js';
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

<!-- Single unified layout - container handles sizing -->
<div class="h-full w-full">
	{#each Object.entries(viewComponents) as [name, Component]}
		{#if $currentView === name}
			<svelte:component this={Component} />
		{/if}
	{/each}
</div>
