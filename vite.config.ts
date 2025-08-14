import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { defineConfig } from 'vitest/config';

export default defineConfig({
		resolve: process.env.VITEST
		? {
				conditions: ['browser']
			}
		: undefined,
	plugins: [
		enhancedImages(), 
		sveltekit()
	],
	// Vitest configuration
	test: {
		environment: 'jsdom',
		globals: true,
	}
});