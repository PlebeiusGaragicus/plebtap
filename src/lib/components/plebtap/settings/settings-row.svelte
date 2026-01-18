<!-- src/lib/components/plebtap/settings/settings-row.svelte -->
<!-- Reusable settings row with icon, label, and action slot (e.g., switch, button) -->
<script lang="ts">
	import type { Snippet, Component } from 'svelte';

	interface Props {
		/** Lucide icon component */
		icon: Component;
		/** Label text */
		label: string;
		/** Optional description text below label */
		description?: string;
		/** Action slot (switch, button, etc.) */
		children?: Snippet;
		/** Whether to show bottom border */
		showBorder?: boolean;
	}

	let { icon: Icon, label, description, children, showBorder = true }: Props = $props();
</script>

<div class="flex items-center justify-between py-4 {showBorder ? 'border-b' : ''}">
	<div class="flex items-center gap-3">
		<Icon class="h-5 w-5 text-muted-foreground" />
		<div>
			<span class="text-sm font-medium">{label}</span>
			{#if description}
				<p class="text-xs text-muted-foreground">{description}</p>
			{/if}
		</div>
	</div>
	{#if children}
		{@render children()}
	{/if}
</div>
