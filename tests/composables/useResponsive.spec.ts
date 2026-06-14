import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useResponsive } from '@/composables/useResponsive'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        apiUrl: { value: '//localhost:8080' },
        hostUrl: { value: 'http://localhost/' },
        hostPort: { value: 8080 },
        instancesDB: { value: 'moonraker' },
        socketIsConnected: { value: false },
        guiIsReady: { value: false },
        klippyIsConnected: { value: true },
        klipperState: { value: 'ready' },
        klipperReadyForGui: { value: true },
        klipperAppName: { value: 'Klipper' },
        printerIsPrinting: { value: false },
        printerIsPrintingOnly: { value: false },
        printerPowerDevice: { value: 'printer' },
        isPrinterPowerOff: { value: false },
        loadings: { value: [] },
        printer_state: { value: 'ready' },
        isMobile: { value: false },
        isTablet: { value: false },
        isDesktop: { value: true },
        isWidescreen: { value: false },
        viewport: { value: 'desktop' },
        isTouchDevice: { value: false },
        isIOS: { value: false },
        moonrakerComponents: { value: ['history'] },
        existGcodesRootDirectory: { value: true },
        spoolManagerUrl: { value: undefined },
        formatTimeOptions: { value: { timeStyle: 'short' } },
        formatTimeWithSecondsOptions: { value: { timeStyle: 'short' } },
        browserLocale: { value: 'en-US' },
        hours12Format: { value: false },
        formatDate: vi.fn(),
        formatTime: vi.fn(),
        formatDateTime: vi.fn(),
    }),
}))

describe('useResponsive', () => {
    let store: ReturnType<typeof createStore>
    let observe: ReturnType<typeof vi.fn>
    let unobserve: ReturnType<typeof vi.fn>
    let lastObserver: any

    beforeEach(() => {
        observe = vi.fn()
        unobserve = vi.fn()
        lastObserver = null

        const MockResizeObserver = class {
            observe = observe
            unobserve = unobserve
            disconnect = vi.fn()

            constructor() {
                lastObserver = this
            }
        }

        vi.stubGlobal('ResizeObserver', MockResizeObserver as any)

        store = createStore({
            state: {
                socket: {
                    isConnected: false,
                    initializationList: [],
                    loadings: [],
                    port: 8080,
                    hostname: 'localhost',
                },
                server: {
                    klippy_connected: true,
                    klippy_state: 'ready',
                    components: [],
                    registered_directories: [],
                    config: { config: {} },
                },
                printer: {
                    print_stats: { state: 'standby' },
                    idle_timeout: { state: 'standby' },
                    app_name: 'Klipper',
                    configfile: { settings: {} },
                    gcode: { commands: {} },
                    toolhead: { homed_axes: '' },
                    gcode_move: { absolute_coordinates: true },
                },
                gui: {
                    general: { timeFormat: '24hours', dateFormat: null },
                    uiSettings: { mode: 'dark', boolWebcamNavi: false },
                },
            },
            getters: {
                'socket/getUrl': () => '//localhost:8080',
                'socket/getHostUrl': () => 'http://localhost/',
                'server/power/getDevices': () => [],
                'gui/getHours12Format': () => false,
            },
        })
    })

    function mountComposable() {
        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useResponsive({
                    small: (el) => el.width < 300,
                })
                return () => h('div', { ref: result.targetRef })
            },
        })

        const wrapper = mount(TestComponent, {
            global: { plugins: [store] },
        })

        return { result, wrapper }
    }

    it('exposes base properties and a reactive target ref', () => {
        const { result } = mountComposable()
        expect(result.apiUrl.value).toBe('//localhost:8080')
        expect(result.targetRef.value).toBeTruthy()
        expect(result.el.is).toEqual({})
    })

    it('creates a ResizeObserver on mount when breakpoints are provided', async () => {
        const { wrapper } = mountComposable()
        await nextTick()
        await nextTick()

        expect(lastObserver).toBeTruthy()
        expect(observe).toHaveBeenCalled()

        wrapper.unmount()
        expect(unobserve).toHaveBeenCalled()
    })
})
