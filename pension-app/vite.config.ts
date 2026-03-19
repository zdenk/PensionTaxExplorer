/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When deployed to GitHub Pages the app lives at /<repo-name>/.
// Set VITE_BASE_PATH in CI (e.g. "/pension-tax-explorer/") or leave it
// unset for local dev (defaults to "/").
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
});
