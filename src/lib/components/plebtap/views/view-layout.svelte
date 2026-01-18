<!-- src/lib/components/plebtap/views/view-layout.svelte -->
<!-- Unified layout component for all views - provides consistent structure -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Button from '$lib/components/ui/button/button.svelte';
	import { navigateTo, type ViewName } from '$lib/stores/navigation.js';

	interface Props {
		/** Title displayed in the header */
		title?: string;
		/** View to navigate back to when back button is clicked */
		backTo?: ViewName;
		/** Custom header snippet - overrides title/backTo if provided */
		header?: Snippet;
		/** Main content - rendered in scrollable area */
		children: Snippet;
		/** Fixed footer content - rendered below scrollable area */
		footer?: Snippet;
		/** If true, removes default padding from content area */
		noPadding?: boolean;
		/** Additional classes for the content area */
		contentClass?: string;
	}

	let {
		title,
		backTo,
		header,
		children,
		footer,
		noPadding = false,
		contentClass = ''
	}: Props = $props();
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	{#if header}
		{@render header()}
	{:else if title || backTo}
		<div class="flex shrink-0 items-center gap-2 p-2">
			{#if backTo}
				<Button variant="ghost" size="icon" onclick={() => navigateTo(backTo)}>
					<ChevronLeft class="h-4 w-4" />
				</Button>
			{/if}
			{#if title}
				<h3 class="text-lg font-medium">{title}</h3>
			{/if}
		</div>
	{/if}

	<!-- Scrollable content -->
	<div class="flex-1 overflow-y-auto {noPadding ? '' : 'p-4'} {contentClass}">
		{@render children()}
	</div>

	<!-- Fixed footer -->
	{#if footer}
		<div class="shrink-0 border-t p-4">
			{@render footer()}
		</div>
	{/if}
</div>
