import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 部署到 /console/ 子路径时必须把 base 设为 '/console/'，让构建产物里的
// <script src> / <link href> / 动态 import / 路由 BASE_URL 都自动加前缀。
//
// 优先级：CLI --base=...（最高）  >  env VITE_BASE_PATH  >  按命令默认
// - vite build：默认 '/console/'（与 nginx 剥离 /console/ 前缀 + serve 一致）
// - vite / vite preview：默认 '/'，本地开发仍访问根路径即可
export default defineConfig(({ command }) => ({
  base:
    process.env.VITE_BASE_PATH ||
    (command === 'build' ? '/console/' : '/'),
  plugins: [vue()],
  build: {
    cssMinify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
    },
  },
}))
