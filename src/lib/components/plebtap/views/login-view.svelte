<!-- src/lib/components/plebtap/views/login-view.svelte -->
<script lang="ts">
	import { isConnecting } from '$lib/stores/nostr.js';
	import { appState, InitStatus } from '$lib/services/init.svelte.js';
	import { navigateTo } from '$lib/stores/navigation.js';
	import { onMount } from 'svelte';
	import ViewContainer from './view-container.svelte';
	import ViewLayout from './view-layout.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import LogIn from '@lucide/svelte/icons/log-in';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Key from '@lucide/svelte/icons/key';
	import FileKey from '@lucide/svelte/icons/file-key';
	import MonitorSmartphone from '@lucide/svelte/icons/monitor-smartphone';
	import Separator from '$lib/components/ui/separator/separator.svelte';

	let hasNostrExtension = $state<boolean>(false);

	onMount(() => {
		// Check if extension exists
		hasNostrExtension = !!window.nostr;
	});
</script>

<ViewContainer>
	<ViewLayout>
		<div class="text-center">
			<p class="text-sm text-gray-500">Choose how you want to get started</p>
		</div>

		<!-- Login Options -->
		<div class="mt-4 space-y-3">
			<!-- Generate New Key -->
			<Button
				variant="default"
				class="w-full justify-start"
				disabled={appState.status === InitStatus.INITIALIZING}
				onclick={() => navigateTo('login-generate-key')}
			>
				<UserPlus class="mr-2 h-4 w-4" />
				Create new account
			</Button>
			<!-- Link Device login -->
			<Button
				variant="outline"
				class="w-full justify-start"
				disabled={appState.status === InitStatus.INITIALIZING}
				onclick={() => navigateTo('login-link-device')}
			>
				<MonitorSmartphone class="mr-2 h-4 w-4" />
				Link from another device
			</Button>
		</div>

		<Separator class="my-4" />

		<div class="space-y-3">
			<h4 class="text-center text-sm text-gray-500">Or use existing Nostr Identity</h4>
			<!-- Extension Login -->
			<Button
				variant="outline"
				class="w-full justify-start"
				disabled={!hasNostrExtension || $isConnecting || appState.status === InitStatus.INITIALIZING}
				onclick={() => navigateTo('login-nip-07')}
			>
				<LogIn class="mr-2 h-4 w-4" />
				{hasNostrExtension ? 'Continue with Nostr extension' : 'No Nostr Extension Found'}
			</Button>
			<!-- Seed Phrase Import -->
			<Button
				variant="outline"
				class="w-full justify-start"
				disabled={appState.status === InitStatus.INITIALIZING}
				onclick={() => navigateTo('login-import-mnemonic')}
			>
				<FileKey class="mr-2 h-4 w-4" />
				Import Seed Phrase
			</Button>
			<!-- Private Key Input -->
			<Button
				variant="outline"
				class="w-full justify-start"
				disabled={appState.status === InitStatus.INITIALIZING}
				onclick={() => navigateTo('login-private-key')}
			>
				<Key class="mr-2 h-4 w-4" />
				Sign in with Private Key
			</Button>
		</div>
	</ViewLayout>
</ViewContainer>
