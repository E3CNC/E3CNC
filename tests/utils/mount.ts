/**
 * Vue component mount utilities for testing
 * 
 * Provides helpers to mount Vue components with all necessary dependencies
 * (Vuetify, Vuex store, Vue Router, i18n, etc.)
 */

import { mount, VueWrapper, MountingOptions } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { Store } from 'vuex'
import { createMockStore } from './store'
import { SOCKET_KEY } from '@/composables/useSocket'

// Create a minimal Vuetify instance for testing
const vuetify = createVuetify({
    components,
    directives,
})

// Create a minimal i18n instance for testing
const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            App: {
                Printers: 'Printers',
            },
            Router: {
                Dashboard: 'Dashboard',
                Console: 'Console',
                Files: 'Files',
                History: 'History',
                Timelapse: 'Timelapse',
                Machine: 'Machine',
                Webcam: 'Webcam',
            },
        },
    },
})

// Create a minimal router for testing
const router = createRouter({
    history: createMemoryHistory(),
    routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/allPrinters', component: { template: '<div>Printers</div>' } },
    ],
})

// Mock WebSocket client
const mockSocket = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    close: vi.fn(),
    connect: vi.fn(),
}

export interface MountComponentOptions<T> extends Omit<MountingOptions<T>, 'global'> {
    store?: Store<any>
    socket?: any
    router?: typeof router
    vuetify?: typeof vuetify
    i18n?: typeof i18n
    plugins?: any[]
    stubs?: Record<string, any>
    provide?: Record<string | symbol, any>
}

/**
 * Mounts a Vue component with all necessary dependencies for testing
 */
export async function mountComponent<T>(
    component: T,
    options: MountComponentOptions<T> = {}
): Promise<VueWrapper<any>> {
    const {
        store = createMockStore(),
        socket = mockSocket,
        router: routerInstance = router,
        vuetify: vuetifyInstance = vuetify,
        i18n: i18nInstance = i18n,
        plugins = [],
        stubs = {},
        provide = {},
        ...mountOptions
    } = options

    // Wait for router to be ready
    await routerInstance.isReady()

    const globalConfig: MountingOptions<any>['global'] = {
        plugins: [vuetifyInstance, i18nInstance, store, routerInstance, ...plugins],
        provide: {
            [SOCKET_KEY as symbol]: socket,
            ...provide,
        },
        stubs: {
            // Stub heavy components by default
            Teleport: true,
            ...stubs,
        },
    }

    return mount(component as any, {
        ...mountOptions,
        global: globalConfig,
    })
}

/**
 * Mounts a component with a custom store configuration
 */
export async function mountWithStore<T>(
    component: T,
    storeOptions: Parameters<typeof createMockStore>[0] = {},
    mountOptions: Omit<MountComponentOptions<T>, 'store'> = {}
): Promise<VueWrapper<any>> {
    const store = createMockStore(storeOptions)
    return mountComponent(component, { ...mountOptions, store })
}

/**
 * Creates a wrapper for testing composables
 */
export function createComposableWrapper<T>(
    composable: () => T,
    store: Store<any> = createMockStore(),
    socket: any = mockSocket
): { wrapper: VueWrapper<any>; composable: T } {
    let composableResult: T | undefined

    const TestComponent = {
        setup() {
            composableResult = composable()
            return {}
        },
        template: '<div></div>',
    }

    const wrapper = mount(TestComponent, {
        global: {
            plugins: [store, vuetify, i18n, router],
            provide: {
                [SOCKET_KEY as symbol]: socket,
            },
        },
    })

    return { wrapper, composable: composableResult! }
}

// Re-export vi for convenience
import { vi } from 'vitest'
