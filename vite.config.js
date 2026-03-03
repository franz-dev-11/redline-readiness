import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
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

          return 'vendor'
        },
      },
    },
  },
})
