import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useNavigation } from '@/composables/useNavigation'

let mockStore: any

vi.mock('vuex', () => ({
    useStore: () => mockStore,
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klippyIsConnected: { value: true },
    }),
}))

vi.mock('@/routes', () => ({
    default: [
        {
            title: 'Dashboard',
            path: '/dashboard',
            icon: 'dash',
            showInNavi: true,
            position: 5,
        },
        {
            title: 'Webcam',
            path: '/webcam',
            icon: 'cam',
            showInNavi: true,
            position: 2,
        },
        {
            title: 'History',
            path: '/history',
            icon: 'hist',
            showInNavi: true,
            position: 1,
            moonrakerComponent: 'history',
        },
    ],
}))

function mountComposable() {
    let result: any

    const TestComponent = defineComponent({
        setup() {
            result = useNavigation()
            return () => h('div')
        },
    })

    mount(TestComponent)
    return result
}

describe('useNavigation', () => {
    beforeEach(() => {
        mockStore = {
            getters: {
                'farm/countPrinters': 2,
                'files/getCustomNaviPoints': null,
                'gui/webcams/getWebcams': [],
            },
            state: {
                server: {
                    klippy_state: 'ready',
                    components: ['history'],
                    registered_directories: ['gcodes'],
                },
                gui: {
                    uiSettings: {
                        boolWebcamNavi: false,
                    },
                    navigationSettings: {
                        entries: [{ type: 'route', title: 'Dashboard', position: 20, visible: false }],
                    },
                },
                printer: {
                    configfile: {
                        settings: {},
                    },
                },
            },
        }
    })

    it('sorts navigation points and applies visibility rules', async () => {
        const nav = mountComposable()
        await nextTick()

        expect(nav.countPrinters.value).toBe(2)
        expect(nav.routesNaviPoints.value.map((entry: any) => entry.title)).toContain('App.Printers')
        expect(nav.getUiSettings({ type: 'route', title: 'Dashboard', position: 5, visible: true })).toEqual([20, false])
        expect(nav.showInNavi({ title: 'Dashboard', showInNavi: true, path: '/dashboard', icon: 'dash', position: 5 })).toBe(true)
        expect(nav.showInNavi({ title: 'Webcam', showInNavi: true, path: '/webcam', icon: 'cam', position: 2 })).toBe(false)
        expect(nav.visibleNaviPoints.value.some((entry: any) => entry.title === 'Router.Webcam')).toBe(false)
        expect(nav.naviPoints.value[0].position).toBe(0)
    })
})
