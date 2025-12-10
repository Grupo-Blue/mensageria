import { defineConfig } from 'tsup'

export default defineConfig({
    entry: [
      'src',
      '!src/views/*.html',
      '!src/*.json',
    ],
    splitting: false,
    sourcemap: false,
    clean: true,
    minify: true,
    format: 'cjs',
    outDir: 'build'
})
