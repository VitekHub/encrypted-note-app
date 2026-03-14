import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [tailwindcss(), vue()],
  base: command === 'build' ? '/encrypted-note-app/' : '/',
}))
