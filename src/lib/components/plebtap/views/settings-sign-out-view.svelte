<!-- src/lib/components/plebtap/views/settings-sign-out-view.svelte -->
<script lang="ts">
	import { isUserMenuOpen, navigateTo } from '$lib/stores/navigation.js';
	import { logout } from '$lib/services/logout.js';

	import { Alert, AlertTitle, AlertDescription } from '$lib/components/ui/alert/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import ViewContainer from './view-container.svelte';

	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import LogOut from '@lucide/svelte/icons/log-out';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Database from '@lucide/svelte/icons/database';

	// Track clear database option
	let clearDatabase = $state(true);

	// Handle the logout confirmation
	async function handleConfirmLogout() {
		// Close the popover/drawer menu
		isUserMenuOpen.set(false);

		// Call the centralized logout function
		await logout({ clearDatabase });

		// Force page refresh to ensure clean state
		window.location.reload();
	}
</script>

<ViewContainer className="p-0 max-h-[55vh] md:max-h-[60vh]">
	<div class="mb-2 flex items-center p-2">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('settings')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium text-destructive">Sign Out</h3>
	</div>

	<ScrollArea class="p-2">
		<div class="max-h-[60vh] px-2 md:max-h-[50vh]">
			<div class="space-y-4">
				<p class="text-sm text-muted-foreground">
					You're about to sign out of PlebTap.
				</p>

				<!-- Warning alert -->
				<Alert variant="warning">
					<TriangleAlert class="h-4 w-4" />
					<AlertTitle>Remember your keys</AlertTitle>
					<AlertDescription>
						When you sign out, you'll need your private key or a Nostr extension to sign back in. Make
						sure you have saved your private key in a secure location.
					</AlertDescription>
				</Alert>

				<!-- Clear database option -->
				<div class="border-t pt-4">
					<div class="flex items-start space-x-2">
						<Checkbox id="clear-database" bind:checked={clearDatabase} />
						<div class="grid gap-1.5 leading-none">
							<label
								for="clear-database"
								class="flex items-center text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								<Database class="mr-1 h-4 w-4 text-muted-foreground" />
								Clear local chat database
							</label>
							<p class="text-xs text-muted-foreground">
								All chat data is encrypted and only accessible with your key. You can safely leave
								this unchecked if you plan to sign in again on this device.
							</p>
						</div>
					</div>
				</div>

				<!-- Action buttons -->
				<div class="flex gap-2 pt-4">
					<Button variant="outline" class="flex-1" onclick={() => navigateTo('settings')}>
						Cancel
					</Button>
					<Button variant="destructive" class="flex-1" onclick={handleConfirmLogout}>
						<LogOut class="mr-2 h-4 w-4" />
						Sign Out
					</Button>
				</div>
			</div>
		</div>
	</ScrollArea>
</ViewContainer>
