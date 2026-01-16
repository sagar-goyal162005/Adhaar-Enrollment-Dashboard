import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        // Use IPv4 loopback explicitly to avoid localhost -> ::1 IPv6 issues on Windows
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
})
