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

	let canPasteFromClipboard =
		typeof navigator !== 'undefined' &&
		!!navigator.clipboard &&
		!!navigator.clipboard.readText &&
		window.isSecureContext;

	let instructionText = $derived(getInstructionText($context.sourceView));

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

	function processScannedData(scannedData: string) {
		if (scannedData && scannedData.includes('nostr:link:')) {
			scanResult.setResult('link', scannedData);
			navigateTo('login-link-device');
			return;
		}

		const scanType = identifyScanType(scannedData);
		scanResult.setResult(scanType, scannedData);

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

	async function handlePaste() {
		const text = await pasteFromClipboard();
		if (text) {
			processScannedData(text);
		} else {
			toast.error('Failed to read from clipboard');
		}
	}
</script>

<ViewContainer>
	<ViewLayout title="Scan QR Code" backTo={$context.sourceView}>
		<div class="space-y-4">
			<div class="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
				<QrScanner onscanned={processScannedData} />
			</div>

			<div class="text-center text-sm text-muted-foreground">
				{instructionText}
			</div>

			{#if canPasteFromClipboard}
				<Button variant="outline" class="w-full" onclick={handlePaste}>
					<ClipboardPaste class="mr-2 h-4 w-4" />
					Paste from clipboard
				</Button>
			{/if}
		</div>
	</ViewLayout>
</ViewContainer>
