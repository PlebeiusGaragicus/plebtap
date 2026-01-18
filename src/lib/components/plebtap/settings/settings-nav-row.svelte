<!-- src/lib/components/plebtap/settings/settings-nav-row.svelte -->
<!-- Reusable settings navigation row with icon, label, and chevron -->
<script lang="ts">
	import type { Component } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { navigateTo, type ViewName } from '$lib/stores/navigation.js';

	interface Props {
		/** Lucide icon component */
		icon: Component;
		/** Label text */
		label: string;
		/** View to navigate to */
		to: ViewName;
		/** Optional description text below label */
		description?: string;
		/** Whether to show bottom border */
		showBorder?: boolean;
		/** Optional variant for destructive actions */
		variant?: 'default' | 'destructive';
	}

	let {
		icon: Icon,
		label,
		to,
		description,
		showBorder = true,
		variant = 'default'
	}: Props = $props();
</script>

<button
	type="button"
	class="flex w-full items-center justify-between py-4 transition-colors hover:bg-muted/50 {showBorder ? 'border-b' : ''}"
	onclick={() => navigateTo(to)}
>
	<div class="flex items-center gap-3 {variant === 'destructive' ? 'text-destructive' : ''}">
		<Icon class="h-5 w-5 {variant === 'destructive' ? '' : 'text-muted-foreground'}" />
		<div class="text-left">
			<span class="text-sm font-medium">{label}</span>
			{#if description}
				<p class="text-xs text-muted-foreground">{description}</p>
			{/if}
		</div>
	</div>
	<ChevronRight class="h-4 w-4 text-muted-foreground" />
</button>
