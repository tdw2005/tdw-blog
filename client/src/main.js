import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(router)

app.provide('initialData', typeof window !== 'undefined' ? (window.__INITIAL_DATA__ || null) : null)

router.isReady().then(() => {
  app.mount('#app')
})
