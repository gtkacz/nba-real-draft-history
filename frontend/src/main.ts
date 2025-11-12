import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Import Vuetify FIRST
import vuetify from './plugins/vuetify'

import App from './App.vue'
import router from './router'

import './assets/styles/team-colors.css'
import './assets/styles/main.scss'

const app = createApp(App)

app.use(vuetify)
app.use(createPinia())
app.use(router)

app.mount('#app')
