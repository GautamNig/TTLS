import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/TTLS',
  server: {
    port: 3000,
    open: true
  }
})