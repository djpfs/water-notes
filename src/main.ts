import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import { initPwaUpdate } from '@/composables/usePwaUpdate'
import { i18n } from '@/i18n'
import router from './router'
import './styles/tokens.css'

initPwaUpdate()

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(i18n)
app.use(router)
app.mount('#app')
