import { createSSRApp } from 'vue'
import App from './App.vue'
import router from './router'
import { renderToString } from '@vue/server-renderer'

export async function render(url, initialData) {
  const app = createSSRApp(App)
  app.use(router)
  app.provide('initialData', initialData || null)
  await router.push(url || '/')
  await router.isReady()
  const appHtml = await renderToString(app)
  return { appHtml }
}
