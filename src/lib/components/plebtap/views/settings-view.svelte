<!-- src/lib/components/plebtap/views/settings-view.svelte -->
<script lang="ts">
	import { mode, setMode } from 'mode-watcher';

	import Switch from '$lib/components/ui/switch/switch.svelte';
	import ViewContainer from './view-container.svelte';
	import ViewLayout from './view-layout.svelte';
	import SettingsRow from '../settings/settings-row.svelte';
	import SettingsNavRow from '../settings/settings-nav-row.svelte';

	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import MonitorSmartphone from '@lucide/svelte/icons/monitor-smartphone';
	import Database from '@lucide/svelte/icons/database';
	import Banknote from '@lucide/svelte/icons/banknote';
	import Router from '@lucide/svelte/icons/router';
	import Key from '@lucide/svelte/icons/key';
	import LogOut from '@lucide/svelte/icons/log-out';

	function toggleTheme() {
		if (mode.current === 'dark') {
			setMode('light');
		} else {
			setMode('dark');
		}
	}
</script>

<ViewContainer>
	<ViewLayout title="Settings" backTo="main" noPadding contentClass="px-4">
		<!-- Theme toggle -->
		<SettingsRow icon={mode.current === 'dark' ? Moon : Sun} label="Dark Mode">
			<Switch checked={mode.current === 'dark'} onCheckedChange={toggleTheme} />
		</SettingsRow>

		<!-- Navigation rows -->
		<SettingsNavRow icon={MonitorSmartphone} label="Link New Device" to="settings-link-device" />
		<SettingsNavRow icon={Database} label="Wallet Sync" to="settings-wallet-sync" />
		<SettingsNavRow icon={Banknote} label="Mint Management" to="settings-mint-management" />
		<SettingsNavRow icon={Router} label="Relay Management" to="settings-relay-management" />
		<SettingsNavRow icon={Key} label="Nostr Keys" to="settings-nostr-keys" />
		<SettingsNavRow icon={LogOut} label="Sign Out" to="settings-sign-out" variant="destructive" showBorder={false} />
	</ViewLayout>
</ViewContainer>
