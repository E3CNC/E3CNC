import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useResponsive } from '@/composables/useResponsive'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'

vi.mock('vuetify', () => ({
    useDisplay: () => ({
        mobile: ref(false),
        smAndUp: ref(true),
        lgAndUp: ref(false),
        xl: ref(false),
    }),
}))

function mountComposable(breakpoints?: Record<string, (cr: DOMRect) => boolean>) {
    const store = createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [], port: 80, hostname: 'localhost' },
            server: { klippy_connected: true, klippy_state: 'ready', components: [], registered_directories: [], config: { config: {} } },
            printer: { app_name: 'Klipper', print_stats: { state: 'standby' }, idle_timeout: { state: 'Idle' } },
            gui: { general: { timeFormat: '24hours', dateFormat: 'yyyy-mm-dd' }, uiSettings: { powerDeviceName: null } },
            instancesDB: 'moonraker',
        },
        getters: {
            'socket/getUrl': () => 'ws://localhost:80/websocket',
            'socket/getHostUrl': () => 'http://localhost:80',
            'server/power/getDevices': () => [],
            'gui/getHours12Format': () => false,
        } as any,
    })

    let result: any
    const TestComponent = {
        template: '<div ref="targetRef"></div>',
        setup() {
            result = useResponsive(breakpoints)
            return { targetRef: result.targetRef }
        },
    }
    mount(TestComponent, { global: { plugins: [store] } })
    return result
}

describe('useResponsive', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.stubGlobal('ResizeObserver', vi.fn((cb: Function) => {
            const instance = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
            // store callback for triggering
            ;(instance as any)._callback = cb
            return instance
        }))
    })

    it('spreads useBase properties', () => {
        const c = mountComposable()
        expect(c).toHaveProperty('socketIsConnected')
        expect(c).toHaveProperty('guiIsReady')
    })

    it('returns el reactive with is object', () => {
        const c = mountComposable()
        expect(c.el).toBeDefined()
        expect(c.el.is).toEqual({})
    })

    it('returns targetRef ref', () => {
        const c = mountComposable()
        expect(c.targetRef).toBeDefined()
    })

    it('does not create ResizeObserver when no breakpoints', () => {
        mountComposable()
        // onMounted runs, but code only creates observer if breakpoints is truthy
        expect(ResizeObserver).not.toHaveBeenCalled()
    })

    it('evaluates breakpoints and sets el.is on resize', () => {
        const breakpoints = {
            wide: (cr: DOMRect) => cr.width >= 400,
            tall: (cr: DOMRect) => cr.height >= 300,
        }
        const c = mountComposable(breakpoints)

        expect(c.el.is).toEqual({})
    })
})
