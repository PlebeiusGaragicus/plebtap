<!-- src/lib/components/plebtap/views/scanner-view.svelte -->
<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { scanResult, identifyScanType } from '$lib/stores/scan-store.js';
	import { navigateTo, context, type ViewName } from '$lib/stores/navigation.js';
	import { pasteFromClipboard } from '$lib/utils/clipboard.js';

	import { Button } from '$lib/components/ui/button/index.js';
	import ViewContainer from './view-container.svelte';
	import ViewLayout from './view-layout.svelte';
	import QrScanner from '../wallet/qr-scanner.svelte';

	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';

	// Clipboard state
	let canPasteFromClipboard =
		typeof navigator !== 'undefined' &&
		!!navigator.clipboard &&
		!!navigator.clipboard.readText &&
		window.isSecureContext;

	// Get context-specific instruction text
	$: instructionText = getInstructionText($context.sourceView);

	// Set instructions from source view
	function getInstructionText(sourceView: ViewName): string {
		switch (sourceView) {
			case 'send':
				return 'Scan a Lightning invoice to pay';
			case 'receive':
				return 'Scan an Ecash token to receive';
			case 'login-private-key':
				return 'Scan a private key QR code';
			case 'login-link-device':
				return 'Scan the QR code from your primary device';
			case 'main':
			default:
				return 'Scan a Lightning invoice or Ecash token';
		}
	}

	// Handle QR scanner result
	function handleQrScanned(event: any) {
		const scannedData = event.detail;

		// Check if it's a Nostr link format specifically
		if (scannedData && scannedData.includes('nostr:link:')) {
			// This is a device link QR code
			scanResult.setResult('link', scannedData);
			navigateTo('login-link-device');
			return;
		}

		// For other QR codes, use the general helper function
		const scanType = identifyScanType(scannedData);

		// Set the scan result in the store
		scanResult.setResult(scanType, scannedData);

		// Determine where to navigate based on scan type and context
		switch (scanType) {
			case 'lightning':
				navigateTo('send');
				break;
			case 'ecash':
				navigateTo('receive');
				break;
			case 'private-key':
				navigateTo('login-private-key');
				break;
			case 'unknown':
			default:
				toast.error('Unrecognized QR code format');
				navigateTo($context.sourceView);
				break;
		}
	}

	// Handle paste from clipboard
	async function handlePaste() {
		const text = await pasteFromClipboard();
		if (text) {
			// Process pasted text just like we would with a scanned QR code
			handleQrScanned({ detail: text });
		} else {
			toast.error('Failed to read from clipboard');
		}
	}
</script>

<ViewContainer>
	<ViewLayout title="Scan QR Code" backTo={$context.sourceView}>
		<div class="space-y-4">
			<!-- QR Scanner -->
			<div class="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
				<QrScanner on:scanned={handleQrScanned} />
			</div>

			<!-- Instructions -->
			<div class="text-center text-sm text-muted-foreground">
				{instructionText}
			</div>

			<!-- Paste button (if clipboard is available) -->
			{#if canPasteFromClipboard}
				<Button variant="outline" class="w-full" onclick={handlePaste}>
					<ClipboardPaste class="mr-2 h-4 w-4" />
					Paste from clipboard
				</Button>
			{/if}
		</div>
	</ViewLayout>
</ViewContainer>
