import { initDebug } from "$lib/utils/debug.js";

// Disable SSR for client-side rendering
export const ssr = false;

// Enable prerendering for static site generation
export const prerender = true;

// Initialize debug tools early
initDebug();
