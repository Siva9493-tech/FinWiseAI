// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
// Output stays "static" by default: every marketing/dashboard page is
// pre-rendered. Only routes that opt out with `export const prerender = false`
// (the AI advisor endpoint) run on-demand on the server, which is what keeps
// the Groq API key off the client.
export default defineConfig({
	adapter: vercel(),
	vite: {
		plugins: [tailwindcss()],
	},
});
