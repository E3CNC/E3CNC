import 'regenerator-runtime'
import 'resize-observer-polyfill'
import { createApp } from 'vue'
import App from '@/App.vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as vuetifyDirectives from 'vuetify/directives'
import { aliases as mdiAliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { DatasetComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VueToast from 'vue-toast-notification'
import VueLoadImage from '@/components/ui/VueLoadImage.vue'
import EChart from 'vue-echarts'
import { ObserveVisibility } from 'vue-observe-visibility'
import 'vue-toast-notification/dist/theme-sugar.css'
import 'vuetify/styles'
import 'overlayscrollbars/overlayscrollbars.css'

import { WebSocketClient, type WebSocketPluginOptions } from '@/plugins/webSocketClient'
import { SOCKET_KEY } from '@/composables/useSocket'
import { setSocket } from '@/store/runtime'
import vLongpress from '@/directives/longpress'
import vResponsiveClass from '@/directives/responsive-class'

import { nextTick } from 'vue'
import { setAndLoadLocale } from '@/plugins/i18n'
import router from '@/plugins/router'
import store from '@/store'
import i18n from '@/plugins/i18n'

use([SVGRenderer, BarChart, LineChart, PieChart, DatasetComponent, GridComponent, LegendComponent, TooltipComponent])

const vuetify = createVuetify({
    components,
    directives: vuetifyDirectives,
    icons: {
        defaultSet: 'mdi',
        sets: { mdi },
        aliases: mdiAliases,
    },
    theme: {
        defaultTheme: 'dark',
        themes: {
            dark: { dark: true, colors: { accent: '#ff9800' } },
            light: { dark: false, colors: { accent: '#ff9800' } },
        },
    },
    defaults: {
        VSwitch: { color: 'primary' },
    },
    display: {
        mobileBreakpoint: 768,
    },
})

const app = createApp(App)

// Provide the same global properties Vue 2 plugins expected
app.config.globalProperties.$vuetify = vuetify

const initLoad = async () => {
    try {
        const base = import.meta.env.BASE_URL ?? '/'
        const res = await fetch(`${base}config.json`)
        const file = (await res.json()) as Record<string, unknown>

        await store.dispatch('importConfigJson', file)

        const locale = (file.defaultLocale ?? 'en') as string
        await setAndLoadLocale(locale)
    } catch (e) {
        window.console.error('Config init error:', e)
    }

    try {
        const url = store.getters['socket/getWebsocketUrl']
        const socket = new WebSocketClient({ url, store: store as unknown as WebSocketPluginOptions['store'] })

        app.provide(SOCKET_KEY, socket)
        app.config.globalProperties.$socket = socket
        setSocket(socket)

        if (store?.state?.instancesDB === 'moonraker') socket.connect()
    } catch (e) {
        window.console.error('Socket init error:', e)
    }
}

app.use(vuetify)
app.use(i18n)
app.use(router)
app.use(VueToast, { duration: 3000, position: 'top-right' })

app.directive('longpress', vLongpress)
app.directive('responsive-class', vResponsiveClass)
app.directive('observe-visibility', ObserveVisibility)
app.component('VueLoadImage', VueLoadImage)
app.component('EChart', EChart)

initLoad()
    .then(() => {
        app.use(store)
        app.mount('#app')

        window.console.log(
            '%c\n' +
                ' ███████╗ ██████╗   ██████╗ ███╗   ██╗  ██████╗ \n' +
                ' ██╔════╝ ╚════██╗ ██╔════╝ ████╗  ██║ ██╔════╝ \n' +
                ' █████╗    █████╔╝ ██║      ██╔██╗ ██║ ██║      \n' +
                ' ██╔══╝    ╚═══██╗ ██║      ██║╚██╗██║ ██║      \n' +
                ' ███████╗ ██████╔╝ ╚██████╗ ██║ ╚████║ ╚██████╗ \n' +
                ' ╚══════╝ ╚═════╝   ╚═════╝ ╚═╝  ╚═══╝  ╚═════╝ \n' +
                '                                                \n',
            'color: #4CAF50; font-weight: bold;'
        )

        // Restore scroll position after DOM renders
        const savedScroll = Number(localStorage.getItem('cncBodyScrollTop'))
        if (savedScroll) {
            const restoreScroll = (attempts = 0) => {
                document.documentElement.scrollTop = savedScroll
                if (document.documentElement.scrollTop !== savedScroll && attempts < 10) {
                    setTimeout(() => restoreScroll(attempts + 1), 200)
                }
            }
            nextTick(() => restoreScroll())
        }

        // Persist scroll position on unload
        window.addEventListener('beforeunload', () => {
            localStorage.setItem('cncBodyScrollTop', String(document.documentElement.scrollTop))
        })
    })
    .catch((e) => {
        window.console.error('Init failed:', e)
    })
