import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the built app load from a folder (packaged desktop app) as well as from a website
export default defineConfig({
  base: './',
  plugins: [react()],
})