import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Headers required for WebGPU + SharedArrayBuffer on localhost
const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'cross-origin-isolation',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          Object.entries(crossOriginHeaders).forEach(([k, v]) => res.setHeader(k, v));
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          Object.entries(crossOriginHeaders).forEach(([k, v]) => res.setHeader(k, v));
          next();
        });
      },
    },
  ],
  optimizeDeps: {
    // onnxruntime-web ships WASM that must not be pre-bundled by Vite.
    exclude: ['onnxruntime-web'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('firebase')) return 'firebase'
          if (id.includes('maplibre-gl') || id.includes('react-map-gl')) {
            return 'maps'
          }
          if (id.includes('@fortawesome')) return 'icons'
          if (id.includes('react') || id.includes('scheduler')) return 'react'
          if (id.includes('kokoro-js') || id.includes('onnxruntime-web') || id.includes('@huggingface')) return 'kokoro'

          return 'vendor'
        },
      },
    },
  },
})
