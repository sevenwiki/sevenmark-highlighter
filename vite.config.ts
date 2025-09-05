import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			allow: ['..']
		}
	},
	assetsInclude: ['**/*.wasm'],
	optimizeDeps: {
		exclude: ['src/sevenmark-wasm-bundler-v2.0.12']
	}
});
