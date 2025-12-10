// vitest.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
    root: './src',
    esbuild: {
        tsconfigRaw: '{}',
    },
})
