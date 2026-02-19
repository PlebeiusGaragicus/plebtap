<!-- src/lib/components/plebtap/views/view-container.svelte -->
<!-- Handles view transition animations only -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import { direction } from '$lib/stores/navigation.js';

	interface Props {
		children: Snippet;
		/** Animation duration in ms */
		duration?: number;
		/** Animation slide distance in px */
		distance?: number;
	}

	let { children, duration = 300, distance = 300 }: Props = $props();
</script>

<div
	class="absolute inset-0 h-full w-full"
	in:fly={{ x: $direction * distance, duration }}
	out:fly={{ x: $direction * -distance, duration }}
>
	{@render children()}
</div>
