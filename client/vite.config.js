import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const repo = process.env.GITHUB_REPOSITORY?.split('/')?.pop() || ''
const isUserOrg = repo.endsWith('.github.io')
const base = isUserOrg ? '/' : (repo ? `/${repo}/` : '/')

export default defineConfig({
    base,
    plugins: [vue()],
    server: {
        port: 3001,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        },
        cors: true
    },
    build: {
        outDir: 'dist'
    },
    optimizeDeps: {
        include: ['marked', 'dompurify']
    }
})
