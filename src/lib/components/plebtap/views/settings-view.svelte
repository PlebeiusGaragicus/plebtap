<!-- src/lib/components/nostr/NostrSettingsView.svelte -->
<script lang="ts">
	import { mode, setMode } from 'mode-watcher';
	import { navigateTo } from '$lib/stores/navigation.js';

	import Button from '$lib/components/ui/button/button.svelte';
	import Switch from '$lib/components/ui/switch/switch.svelte';

	import ViewContainer from './view-container.svelte';

	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
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

<ViewContainer className="p-0">
	<div class="mb-2 flex items-center p-2">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('main')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Settings</h3>
	</div>

	<!-- Settings content - no height constraints, parent handles scrolling -->
	<div class="px-4">
			<!-- Theme toggle -->
			<div class="flex items-center justify-between border-b py-4">
				<div class="flex items-center space-x-2">
					{#if mode.current === 'dark'}
						<Moon />
					{:else}
						<Sun />
					{/if}
					<span class="text">Dark Mode</span>
				</div>
				<Switch checked={mode.current === 'dark'} onCheckedChange={toggleTheme} />
			</div>

			<!-- Link New Device -->
			<button
				type="button"
				class="flex w-full items-center justify-between border-b py-4 transition-colors hover:bg-muted/50"
				onclick={() => navigateTo('settings-link-device')}
			>
				<div class="flex items-center gap-2">
					<MonitorSmartphone class="h-5 w-5" />
					<span>Link New Device</span>
				</div>
				<ChevronRight class="h-4 w-4 text-muted-foreground" />
			</button>

			<!-- Wallet Sync -->
			<button
				type="button"
				class="flex w-full items-center justify-between border-b py-4 transition-colors hover:bg-muted/50"
				onclick={() => navigateTo('settings-wallet-sync')}
			>
				<div class="flex items-center gap-2">
					<Database class="h-5 w-5" />
					<span>Wallet Sync</span>
				</div>
				<ChevronRight class="h-4 w-4 text-muted-foreground" />
			</button>

			<!-- Mint Management -->
			<button
				type="button"
				class="flex w-full items-center justify-between border-b py-4 transition-colors hover:bg-muted/50"
				onclick={() => navigateTo('settings-mint-management')}
			>
				<div class="flex items-center gap-2">
					<Banknote class="h-5 w-5" />
					<span>Mint Management</span>
				</div>
				<ChevronRight class="h-4 w-4 text-muted-foreground" />
			</button>

			<!-- Relay Management -->
			<button
				type="button"
				class="flex w-full items-center justify-between border-b py-4 transition-colors hover:bg-muted/50"
				onclick={() => navigateTo('settings-relay-management')}
			>
				<div class="flex items-center gap-2">
					<Router class="h-5 w-5" />
					<span>Relay Management</span>
				</div>
				<ChevronRight class="h-4 w-4 text-muted-foreground" />
			</button>

			<!-- Nostr Keys -->
			<button
				type="button"
				class="flex w-full items-center justify-between border-b py-4 transition-colors hover:bg-muted/50"
				onclick={() => navigateTo('settings-nostr-keys')}
			>
				<div class="flex items-center gap-2">
					<Key class="h-5 w-5" />
					<span>Nostr Keys</span>
				</div>
				<ChevronRight class="h-4 w-4 text-muted-foreground" />
			</button>

			<!-- Sign Out -->
			<button
				type="button"
				class="flex w-full items-center justify-between py-4 transition-colors hover:bg-muted/50"
				onclick={() => navigateTo('settings-sign-out')}
			>
				<div class="flex items-center gap-2 text-destructive">
					<LogOut class="h-5 w-5" />
					<span>Sign Out</span>
				</div>
				<ChevronRight class="h-4 w-4 text-muted-foreground" />
			</button>
	</div>
</ViewContainer>
