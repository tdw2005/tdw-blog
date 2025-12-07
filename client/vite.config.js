import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    server: {
        port: 3001,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        },
        cors: true // 开启CORS
    },
    build: {
        outDir: 'dist'
    },
    optimizeDeps: {
        include: ['marked', 'dompurify']
    }
})