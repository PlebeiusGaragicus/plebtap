<script lang="ts">
	import type { Snippet } from "svelte";
	import { getContext, onMount } from "svelte";
	import type { Writable } from "svelte/store";
	import { fly, fade } from "svelte/transition";
	import { cn } from "$lib/utils.js";
	import MobileSheetClose from "./mobile-sheet-close.svelte";

	interface Props {
		children: Snippet;
		class?: string;
		showCloseButton?: boolean;
	}

	let { children, class: className, showCloseButton = true }: Props = $props();

	const { open, close } = getContext<{ open: Writable<boolean>; close: () => void }>("mobile-sheet");

	let isOpen = $state(false);

	// Subscribe to open state
	$effect(() => {
		const unsubscribe = open.subscribe((value) => {
			isOpen = value;
		});
		return unsubscribe;
	});

	// Lock body scroll when open
	$effect(() => {
		if (isOpen) {
			const originalOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = originalOverflow;
			};
		}
	});

	// Close on escape key
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			close();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Overlay -->
	<div
		class="fixed inset-0 z-50 bg-black/50"
		transition:fade={{ duration: 200 }}
		onclick={close}
		role="button"
		tabindex="-1"
		aria-label="Close sheet"
	></div>

	<!-- Sheet content - full screen with safe area padding -->
	<div
		class={cn(
			"fixed inset-0 z-50 flex flex-col bg-background",
			className
		)}
		transition:fly={{ y: "100%", duration: 300 }}
		role="dialog"
		aria-modal="true"
	>
		<!-- Safe area container - applies Apple's app-shell pattern -->
		<!-- Background extends edge-to-edge, content padded inside safe areas -->
		<div
			class="flex flex-1 flex-col overflow-hidden"
			style="
				padding-top: env(safe-area-inset-top, 0px);
				padding-bottom: env(safe-area-inset-bottom, 0px);
				padding-left: env(safe-area-inset-left, 0px);
				padding-right: env(safe-area-inset-right, 0px);
			"
		>
			<!-- Header with close button -->
			{#if showCloseButton}
				<div class="flex items-center justify-end p-2">
					<MobileSheetClose class="p-2 opacity-70 hover:opacity-100 transition-opacity" />
				</div>
			{/if}

			<!-- Content area - scrollable -->
			<div class="flex-1 overflow-y-auto">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
