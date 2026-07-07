import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import App from './App.vue'
import router from './router'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        colors: {
          primary: '#00d4aa',
          secondary: '#16213e',
          surface: '#1a1a2e',
          background: '#121212',
          error: '#ff5252',
          info: '#2196f3',
          success: '#4caf50',
          warning: '#ff8300',
        },
      },
    },
  },
  defaults: {
    VCard: {
      color: 'surface',
    },
    VBtn: {
      variant: 'tonal',
    },
  },
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(vuetify)
app.mount('#app')