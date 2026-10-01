import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // strictPort: fail instead of silently moving to 5174+, which Privy's allowed origins would reject.
  server: { port: 5173, strictPort: true },
})
