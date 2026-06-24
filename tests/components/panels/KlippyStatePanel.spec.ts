import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import KlippyStatePanel from '@/components/panels/KlippyStatePanel.vue'

// Create simple objects with a value property that looks like refs
// We need them to be hoisted so they're available at mock time
const mockBaseValues = vi.hoisted(() => {
    // Minimal ref-like objects that Vue template auto-unwrap handles
    class MockRef {
        _value: any
        __v_isRef = true
        __v_isShallow = false
        constructor(val: any) {
            this._value = val
        }
        get value() {
            return this._value
        }
        set value(v) {
            this._value = v
        }
    }
    return {
        klipperState: new MockRef('shutdown'),
        socketIsConnected: new MockRef(true),
        klippyIsConnected: new MockRef(true),
        isPrinterPowerOff: new MockRef(false),
        printerPowerDevice: new MockRef('printer'),
        apiUrl: new MockRef('//localhost:8080'),
        moonrakerComponents: new MockRef([]),
    }
})

vi.mock('@/composables/useBase', () => ({
    useBase: () => mockBaseValues,
}))

const mockSocketEmit = vi.fn()

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: mockSocketEmit,
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, params?: Record<string, string>) => {
            const translations: Record<string, string> = {
                'Panels.KlippyStatePanel.ServiceReports': '{service} reports',
                'Panels.KlippyStatePanel.Restart': 'Restart',
                'Panels.KlippyStatePanel.FirmwareRestart': 'Firmware Restart',
                'Panels.KlippyStatePanel.KlipperLog': 'Klipper Log',
                'Panels.KlippyStatePanel.MoonrakerLog': 'Moonraker Log',
                'Panels.KlippyStatePanel.PrinterSwitchedOff': 'Printer switched off',
                'Panels.KlippyStatePanel.PrinterSwitchedOffDescription': 'The printer is switched off.',
                'Panels.KlippyStatePanel.PowerOn': 'Power On',
                'Panels.KlippyStatePanel.MoonrakerCannotConnect': 'Moonraker cannot connect',
                'Panels.KlippyStatePanel.CheckKlippyAndUdsAddress': 'Check Klippy and UDS address',
            }
            let result = translations[key] ?? key
            if (params) {
                for (const [k, v] of Object.entries(params)) {
                    result = result.replace(`{${k}}`, v)
                }
            }
            return result
        },
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VAlert: {
        name: 'VAlert',
        inheritAttrs: false,
        props: ['color', 'density', 'variant', 'border'],
        template: '<div :class="$attrs.class" :style="$attrs.style"><slot /><slot name="text" /></div>',
    },
    VIcon: { name: 'VIcon', props: ['start', 'icon', 'color'], template: '<i :class="$attrs.class"><slot /></i>' },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'ripple', 'size', 'variant', 'href', 'color', 'disabled'],
        template: '<button :class="$attrs.class" @click="$attrs.onClick || $attrs.click"><slot /></button>',
    },
    VProgressCircular: {
        name: 'VProgressCircular',
        props: ['indeterminate', 'color'],
        template: '<span><slot /></span>',
    },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VSpacer: { name: 'VSpacer', template: '<span style="flex:1" />' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)
vi.mock('@/components/ui/ConnectionStatus.vue', () => ({
    default: { name: 'ConnectionStatus', template: '<div class="connection-status"><slot /></div>' },
}))

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [] },
            server: {
                klippy_connected: true,
                klippy_state: 'shutdown',
                klippy_message: 'Shutdown due to fatal error',
                components: [],
                ...(overrides.server || {}),
            },
            printer: {
                print_stats: { state: 'standby' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
            },
            gui: {
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                },
                general: { printername: 'Test' },
                control: {},
                uiSettings: {},
                navigationSettings: { entries: [] },
            },
            files: {},
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'socket/getHostUrl': () => '//localhost:8080',
            'gui/getPanelExpand': () => () => true,
            ...(overrides.getters || {}),
        },
    })
}

describe('KlippyStatePanel.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockBaseValues.klipperState.value = 'shutdown'
        mockBaseValues.socketIsConnected.value = true
        mockBaseValues.klippyIsConnected.value = true
        mockBaseValues.isPrinterPowerOff.value = false
        mockBaseValues.printerPowerDevice.value = 'printer'
        mockBaseValues.apiUrl.value = '//localhost:8080'
    })

    it('renders nothing when klipper state is ready', () => {
        mockBaseValues.klipperState.value = 'ready'

        const store = createStoreWithState({
            server: { klippy_connected: true, klippy_state: 'ready', klippy_message: null, components: [] },
        })
        const wrapper = mount(KlippyStatePanel, {
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // With klipperState='ready' (auto-unwrapped ref), v-if="klipperState !== 'ready'" should be false
        expect(wrapper.find('[class]').exists()).toBe(false)
    })

    it('renders nothing when socket is disconnected', () => {
        mockBaseValues.socketIsConnected.value = false

        const store = createStoreWithState({
            socket: { isConnected: false, initializationList: [], loadings: [] },
            server: { klippy_connected: true, klippy_state: 'shutdown', klippy_message: null, components: [] },
        })
        const wrapper = mount(KlippyStatePanel, {
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // With socketIsConnected=false, v-if="socketIsConnected" should be false
        expect(wrapper.find('[class]').exists()).toBe(false)
    })

    it('shows alert with klippy message when klippy is connected and state is shutdown', () => {
        const store = createStoreWithState()
        const wrapper = mount(KlippyStatePanel, {
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('SHUTDOWN')
        expect(wrapper.text()).toContain('Shutdown due to fatal error')
        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.Restart')
        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.FirmwareRestart')
    })

    it('shows progress indicator when klippy is connected but has no message', () => {
        mockBaseValues.klipperState.value = 'startup'

        const store = createStoreWithState({
            server: { klippy_connected: true, klippy_state: 'startup', klippy_message: null, components: [] },
        })
        const wrapper = mount(KlippyStatePanel, {
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.findComponent({ name: 'v-progress-circular' }).exists()).toBe(true)
    })

    it('shows printer power off message when printer is powered off', () => {
        mockBaseValues.klipperState.value = 'disconnected'
        mockBaseValues.klippyIsConnected.value = false
        mockBaseValues.isPrinterPowerOff.value = true

        const store = createStoreWithState({
            server: { klippy_connected: false, klippy_state: '', klippy_message: null, components: [] },
        })
        const wrapper = mount(KlippyStatePanel, {
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.PrinterSwitchedOff')
        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.PowerOn')
        // Should NOT contain Klippy restart buttons
        expect(wrapper.text()).not.toContain('Panels.KlippyStatePanel.Restart')
    })

    it('shows disconnected message with connection status', () => {
        mockBaseValues.klipperState.value = 'disconnected'
        mockBaseValues.klippyIsConnected.value = false

        const store = createStoreWithState({
            server: { klippy_connected: false, klippy_state: '', klippy_message: null, components: [] },
        })
        const wrapper = mount(KlippyStatePanel, {
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.MoonrakerCannotConnect')
        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.CheckKlippyAndUdsAddress')
    })

    it('restart button calls printer.restart via socket', async () => {
        const store = createStoreWithState()
        const wrapper = mount(KlippyStatePanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const restartBtn = buttons.find((b) => b.text().includes('Panels.KlippyStatePanel.Restart'))
        expect(restartBtn).toBeDefined()
        await restartBtn!.trigger('click')
        expect(mockSocketEmit).toHaveBeenCalledWith('printer.restart', {}, { loading: 'restart' })
    })

    it('firmware restart button calls printer.firmware_restart via socket', async () => {
        const store = createStoreWithState()
        const wrapper = mount(KlippyStatePanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const fwBtn = buttons.find((b) => b.text().includes('Panels.KlippyStatePanel.FirmwareRestart'))
        expect(fwBtn).toBeDefined()
        await fwBtn!.trigger('click')
        expect(mockSocketEmit).toHaveBeenCalledWith('printer.firmware_restart', {}, { loading: 'firmwareRestart' })
    })

    it('power on button calls machine.device_power.on via socket', async () => {
        mockBaseValues.klipperState.value = 'disconnected'
        mockBaseValues.klippyIsConnected.value = false
        mockBaseValues.isPrinterPowerOff.value = true

        const store = createStoreWithState({
            server: { klippy_connected: false, klippy_state: '', klippy_message: null, components: [] },
        })
        const wrapper = mount(KlippyStatePanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const powerBtn = buttons.find((b) => b.text().includes('Panels.KlippyStatePanel.PowerOn'))
        expect(powerBtn).toBeDefined()
        await powerBtn!.trigger('click')
        expect(mockSocketEmit).toHaveBeenCalledWith('machine.device_power.post_device', { device: 'printer', action: 'on' }, { action: 'server/power/responseToggle' })
    })
})
