import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config: use `src` as the project root so existing `src/index.html` works.
export default defineConfig({
  root: 'src',
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    // Output to top-level dist directory
    outDir: '../dist',
    emptyOutDir: true
  }
})
