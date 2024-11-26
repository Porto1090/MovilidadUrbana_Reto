import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    hmr: {
      protocol: 'ws'
    }
  },
  resolve: {
    alias: {
      'fsevents': 'fsevents/fsevents.js'
    }
  },
  optimizeDeps: {
    exclude: ['fsevents']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    },
    commonjsOptions: {
      include: [/node_modules/],
      extensions: ['.js', '.cjs']
    }
  }
});