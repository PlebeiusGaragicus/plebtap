<!-- src/lib/components/plebtap/views/settings-link-device-view.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import QRCode from '@castlenine/svelte-qrcode';

	import { ndkInstance } from '$lib/stores/nostr.js';
	import { navigateTo } from '$lib/stores/navigation.js';
	import { createLinkPayload, generateRandomPin } from '$lib/utils/pin.js';

	import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import ViewContainer from './view-container.svelte';

	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	// State variables
	let pin = '';
	let qrData = '';
	let isGenerating = false;
	let privateKey = '';

	// Get private key from NDK signer if available
	$: if ($ndkInstance && $ndkInstance.signer && 'privateKey' in $ndkInstance.signer) {
		privateKey = ($ndkInstance.signer as { privateKey?: string }).privateKey || '';
	}

	// Generate link data
	function generateLinkData() {
		if (!privateKey) {
			toast.error('Private key not available. You may be using a browser extension.');
			return;
		}

		try {
			isGenerating = true;

			// Generate a random 4-digit PIN
			pin = generateRandomPin(4);

			// Create the link payload with encrypted private key
			const payload = createLinkPayload(privateKey, pin);
			qrData = payload.qrData;

			isGenerating = false;
		} catch (error) {
			console.error('Error generating link data:', error);
			toast.error('Failed to generate QR code');
			isGenerating = false;
		}
	}

	// Auto-generate QR code when the component is mounted
	onMount(() => {
		if (privateKey) {
			generateLinkData();
		}
	});
</script>

<ViewContainer className="p-0">
	<div class="mb-2 flex items-center p-2">
		<Button variant="ghost" size="icon" onclick={() => navigateTo('settings')} class="mr-2">
			<ChevronLeft class="h-4 w-4" />
		</Button>
		<h3 class="text-lg font-medium">Link New Device</h3>
	</div>

	<div class="space-y-4 px-4">
				<!-- Instructions -->
				<div class="text-sm text-muted-foreground">
					On your new device, click on "Link from another device" and scan this QR
					code and enter the PIN below to link your account.
				</div>

				<!-- Warning for browser extension users -->
				{#if !privateKey}
					<Alert variant="warning" class="mb-2 py-2 text-xs">
						<AlertDescription>
							Link Devices is not available when using a browser extension. Your private key is
							managed by that extension.
						</AlertDescription>
					</Alert>
				{:else if isGenerating}
					<div class="flex justify-center py-4">
						<div
							class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
						></div>
					</div>
				{:else if qrData}
					<!-- QR Code Display -->
					<div class="flex flex-col items-center space-y-3 px-4">
						<div class="rounded-lg bg-white shadow-sm">
							<QRCode data={qrData} haveBackgroundRoundedEdges padding={2} />
						</div>

						<!-- PIN Display -->
						<div class="text-center">
							<div class="mb-1 text-xs text-muted-foreground">Security PIN</div>
							<div class="flex items-center justify-center">
								<code class="rounded bg-muted px-3 py-1 text-xl font-bold tracking-widest">
									{pin}
								</code>
							</div>
							<div class="mt-2 text-xs text-muted-foreground">
								Enter this PIN on your new device after scanning
							</div>
						</div>
					</div>
				{/if}
	</div>
</ViewContainer>
