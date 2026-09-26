import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist/js', emptyOutDir: true, target: 'es2022', sourcemap: false, minify: true,
    lib: { entry: 'src/main.js', formats: ['es'], fileName: () => 'app.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
