<script lang="ts">
	import type { Snippet } from "svelte";
	import { setContext } from "svelte";
	import { writable } from "svelte/store";

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		onOpenChange,
		children,
	}: Props = $props();

	// Create a store for the open state that can be shared via context
	const openStore = writable(open);
	
	// Sync the store with the prop
	$effect(() => {
		openStore.set(open);
	});

	// Sync prop changes back
	$effect(() => {
		const unsubscribe = openStore.subscribe((value) => {
			if (value !== open) {
				open = value;
				onOpenChange?.(value);
			}
		});
		return unsubscribe;
	});

	setContext("mobile-sheet", {
		open: openStore,
		close: () => {
			openStore.set(false);
		},
		toggle: () => {
			openStore.update((v) => !v);
		},
	});
</script>

{@render children()}
