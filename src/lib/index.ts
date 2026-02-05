// src/lib/index.ts
// Main component
// Note: Consumers should import 'plebtap/styles.css' separately in their layout
export { default as Plebtap } from '$lib/components/plebtap/plebtap.svelte';

// Programmatic API
export { plebtap } from '$lib/api/plebtap-api.svelte.js';

// Navigation state (for external control of popover)
export { isUserMenuOpen } from '$lib/stores/navigation.js';

// Credit balance store (for external display of credits)
export { creditBalance } from '$lib/stores/wallet.js';

// // Utility functions
// export { identifyScanType } from '$lib/stores/scan-store.js';
// export { formatTransactionDescription } from '$lib/utils/tx.js';

// // Types (if needed for consumers)
// export type { ScanResult, ScanResultType } from '$lib/stores/scan-store.js';