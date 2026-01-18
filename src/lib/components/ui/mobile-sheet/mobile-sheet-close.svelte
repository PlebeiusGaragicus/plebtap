<script lang="ts">
	import type { Snippet } from "svelte";
	import { getContext } from "svelte";
	import type { Writable } from "svelte/store";
	import { cn } from "$lib/utils.js";

	interface Props {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className }: Props = $props();

	const { close } = getContext<{ open: Writable<boolean>; close: () => void }>("mobile-sheet");
</script>

<button
	type="button"
	onclick={close}
	class={cn(
		"ring-offset-background focus:ring-ring rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
		className
	)}
>
	{#if children}
		{@render children()}
	{:else}
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
			<path d="M18 6 6 18"/><path d="m6 6 12 12"/>
		</svg>
		<span class="sr-only">Close</span>
	{/if}
</button>
