<script lang="ts">
	import type { Snippet } from "svelte";
	import { getContext } from "svelte";
	import type { Writable } from "svelte/store";

	interface Props {
		children: Snippet;
		class?: string;
	}

	let { children, class: className = "" }: Props = $props();

	const { open } = getContext<{ open: Writable<boolean> }>("mobile-sheet");

	function handleClick() {
		open.set(true);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div onclick={handleClick} class={className}>
	{@render children()}
</div>
