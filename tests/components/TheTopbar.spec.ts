import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'

// ─────────────────────────────────────────────
// Mutable refs for composable mocks
// ─────────────────────────────────────────────
const mockKlipperReadyForGui = ref(false)
const mockKlippyIsConnected = ref(false)
const mockPrinter_state = ref('')
const mockPrinterIsPrinting = ref(false)
const mockLoadings = ref<string[]>([])
const mockIsIOS = ref(false)
const mockApiUrl = ref('http://localhost:8080')
const mockExistGcodesRootDirectory = ref(false)
const mockSidebarLogo = ref<string | null>(null)
const mockSmAndDown = ref(false)
const mockLgAndUp = ref(true)
const mockSocketEmit = vi.fn()

// ─────────────────────────────────────────────
// Vuetify component mocks
// ─────────────────────────────────────────────
const vuetifyComponentsMock = vi.hoisted(() => ({
    VAppBar: {
        name: 'VAppBar',
        props: { app: Boolean, height: [Number, String] },
        template: '<header class="v-app-bar"><slot /></header>',
    },
    VAppBarNavIcon: {
        name: 'VAppBarNavIcon',
        template: '<button class="v-app-bar-nav-icon" @click="$emit(\'click\', $event)" />',
    },
    VToolbarTitle: {
        name: 'VToolbarTitle',
        template: '<span class="v-toolbar-title"><slot /></span>',
    },
    VBtn: {
        name: 'VBtn',
        props: { icon: Boolean, variant: String, color: String, disabled: Boolean, loading: Boolean },
        template:
            '<button class="v-btn" :disabled="disabled" :class="{ \'v-btn--loading\': loading }" @click="$emit(\'click\')"><slot /></button>',
    },
    VSpacer: {
        name: 'VSpacer',
        template: '<span class="v-spacer" />',
    },
    VIcon: {
        name: 'VIcon',
        props: { start: Boolean, icon: String },
        template: '<i class="v-icon"><slot /></i>',
    },
    VSnackbar: {
        name: 'VSnackbar',
        props: { modelValue: Boolean, timeout: [Number, String] },
        template: '<div class="v-snackbar" v-if="modelValue"><slot /><slot name="actions" /></div>',
    },
    VProgressLinear: {
        name: 'VProgressLinear',
        props: { modelValue: Number },
        template: '<div class="v-progress-linear" />',
    },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('vuetify', () => ({
    useDisplay: () => ({
        smAndDown: mockSmAndDown,
        lgAndUp: mockLgAndUp,
    }),
    useTheme: () => ({
        global: { current: { value: { dark: true } } },
    }),
}))

// ─────────────────────────────────────────────
// Composables mocks
// ─────────────────────────────────────────────
vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: mockKlipperReadyForGui,
        klippyIsConnected: mockKlippyIsConnected,
        printer_state: mockPrinter_state,
        printerIsPrinting: mockPrinterIsPrinting,
        loadings: mockLoadings,
        isIOS: mockIsIOS,
        apiUrl: mockApiUrl,
        existGcodesRootDirectory: mockExistGcodesRootDirectory,
    }),
}))

vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({
        sidebarLogo: mockSidebarLogo,
    }),
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: mockSocketEmit,
    }),
}))

// ─────────────────────────────────────────────
// Axios mock
// ─────────────────────────────────────────────
vi.mock('axios', () => ({
    default: {
        post: vi.fn(() => Promise.resolve({ data: { result: 'mock-file.gcode' } })),
        CancelToken: {
            source: () => ({ token: 'mock-token', cancel: vi.fn() }),
        },
    },
    CancelToken: {
        source: () => ({ token: 'mock-token', cancel: vi.fn() }),
    },
}))

// ─────────────────────────────────────────────
// formatFilesize mock
// ─────────────────────────────────────────────
vi.mock('@/plugins/helpers', () => ({
    formatFilesize: vi.fn((bytes: number) => `${bytes.toFixed(1)} kB`),
}))

// ─────────────────────────────────────────────
// Child component mocks
// ─────────────────────────────────────────────
vi.mock('@/components/TheTopCornerMenu.vue', () => ({
    default: { name: 'TheTopCornerMenu', template: '<div class="mock-top-corner" />' },
}))

vi.mock('@/components/TheSettingsMenu.vue', () => ({
    default: { name: 'TheSettingsMenu', template: '<div class="mock-settings" />' },
}))

vi.mock('@/components/ui/PrinterSelector.vue', () => ({
    default: { name: 'PrinterSelector', template: '<div class="mock-printer-selector" />' },
}))

vi.mock('@/components/ui/MainsailLogo.vue', () => ({
    default: {
        name: 'MainsailLogo',
        props: ['color'],
        template: '<div class="mock-mainsail-logo" />',
    },
}))

vi.mock('@/components/notifications/TheNotificationMenu.vue', () => ({
    default: { name: 'TheNotificationMenu', template: '<div class="mock-notifications" />' },
}))

vi.mock('@/components/dialogs/EmergencyStopDialog.vue', () => ({
    default: {
        name: 'EmergencyStopDialog',
        props: ['modelValue'],
        template: '<div v-if="modelValue" class="mock-emergency-dialog" />',
    },
}))

vi.mock('vue-inline-svg', () => ({
    default: {
        name: 'InlineSvg',
        props: ['src'],
        template: '<span class="mock-inline-svg"><slot /></span>',
    },
}))

// ─────────────────────────────────────────────
// vue-i18n mock
// ─────────────────────────────────────────────
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

// ─────────────────────────────────────────────
// vue-router mock
// ─────────────────────────────────────────────
vi.mock('vue-router', () => ({
    useRouter: () => ({
        currentRoute: { value: { fullPath: '/' } },
        push: vi.fn(),
    }),
    useRoute: () => ({ fullPath: '/' }),
}))

// ─────────────────────────────────────────────
// Toast mock + Vue plugin to provide it globally
// ─────────────────────────────────────────────
const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
}

const ToastPlugin = {
    install(app: any) {
        app.config.globalProperties.$toast = mockToast
    },
}

// ─────────────────────────────────────────────
// Mount helper: provides common global config
// ─────────────────────────────────────────────
function mountWithDefaults(component: any, store: any, extraOpts: Record<string, any> = {}) {
    return mount(component, {
        global: {
            plugins: [store, ToastPlugin],
            stubs: {
                'router-link': {
                    template: '<a class="router-link-stub"><slot /></a>',
                },
            },
            mocks: {
                $t: (key: string) => key,
            },
        },
        ...extraOpts,
    })
}

// ─────────────────────────────────────────────
// Store factory
// ─────────────────────────────────────────────
interface StoreState {
    gui?: {
        general?: { printername?: string }
        uiSettings?: Record<string, any>
    }
    printer?: Record<string, any>
    server?: Record<string, any>
    socket?: Record<string, any>
    naviDrawer?: boolean
    [key: string]: any
}

function createStoreWithState(overrides: Partial<StoreState> = {}) {
    const defaults: StoreState = {
        gui: {
            general: { printername: 'MyPrinter' },
            uiSettings: { logo: '#D41216' },
        },
        printer: {
            hostname: 'mainsail-host',
            motion_report: {
                live_position: [100.123, 50.456, 10.789, 0],
                live_velocity: 25.5,
            },
            toolhead: { homed_axes: 'xyz' },
            gcode_move: { absolute_coordinates: true },
            configfile: { save_config_pending: false },
            print_stats: { state: 'standby' },
            idle_timeout: { state: 'standby' },
        },
        server: {
            klippy_connected: false,
            klippy_state: '',
            registered_directories: [],
            components: [],
            config: null,
        },
        socket: {
            isConnected: false,
            initializationList: ['init'],
            hostname: 'localhost',
            port: '80',
            loadings: [],
        },
        naviDrawer: true,
    }

    const merged = mergeDeep(defaults, overrides)

    return createStore({
        state: merged,
        getters: {
            'farm/countPrinters': () => 0,
            'socket/getUrl': () => 'http://localhost:8080',
            'socket/getHostUrl': () => 'http://localhost:8080',
            'gui/getHours12Format': () => false,
            'gui/theme': () => 'mainsail',
            'gui/getTheme': () => ({}),
            'files/getSidebarLogo': () => '',
            'files/getMainBackground': () => null,
            ...((overrides as any).getters || {}),
        },
        dispatch: vi.fn(),
    })
}

// Simple deep merge helper
function mergeDeep(target: any, source: any): any {
    const result = { ...target }
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = mergeDeep(result[key] || {}, source[key])
        } else {
            result[key] = source[key]
        }
    }
    return result
}

// ─────────────────────────────────────────────
// Import the component under test
// ─────────────────────────────────────────────
import TheTopbar from '@/components/TheTopbar.vue'

describe('TheTopbar.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset all mutable refs
        mockKlipperReadyForGui.value = false
        mockKlippyIsConnected.value = false
        mockPrinter_state.value = ''
        mockPrinterIsPrinting.value = false
        mockLoadings.value = []
        mockIsIOS.value = false
        mockApiUrl.value = 'http://localhost:8080'
        mockExistGcodesRootDirectory.value = false
        mockSidebarLogo.value = null
        mockSmAndDown.value = false
        mockLgAndUp.value = true
        mockSocketEmit.mockClear()
    })

    // ── 1. Renders app bar with nav icon ──
    it('renders app bar with nav icon', () => {
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const appBar = wrapper.find('.v-app-bar')
        expect(appBar.exists()).toBe(true)

        const navIcon = wrapper.find('.v-app-bar-nav-icon')
        expect(navIcon.exists()).toBe(true)
    })

    // ── 2. Shows printer name from store ──
    it('shows printer name from store', () => {
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.text()).toContain('MyPrinter')
    })

    it('uses hostname when printername is empty', () => {
        const store = createStoreWithState({
            gui: {
                general: { printername: '' },
                uiSettings: { logo: '#D41216' },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.text()).toContain('mainsail-host')
    })

    // ── 3. Shows DRO when klipperReadyForGui is true ──
    it('shows DRO when klipperReadyForGui is true', () => {
        mockKlipperReadyForGui.value = true
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const dro = wrapper.find('.topbar-dro')
        expect(dro.exists()).toBe(true)
        // All axes are homed, so labels should show
        expect(wrapper.text()).toContain('X')
        expect(wrapper.text()).toContain('Y')
        expect(wrapper.text()).toContain('Z')
        // Velocity
        expect(wrapper.text()).toContain('25.5 mm/s')
        // Mode (absolute)
        expect(wrapper.text()).toContain('G90')
    })

    it('shows DRO axes values with correct formatting', () => {
        mockKlipperReadyForGui.value = true
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        // X: 100.123 → 100.12 (2 digits, no trailing zeros)
        // Y: 50.456 → 50.46 (2 digits, rounded)
        // Z: 10.789 → 10.79 (2 digits)
        expect(wrapper.text()).toContain('100.12')
        expect(wrapper.text()).toContain('50.46')
        expect(wrapper.text()).toContain('10.79')
    })

    it('shows G91 mode when absolute_coordinates is false', () => {
        mockKlipperReadyForGui.value = true
        const store = createStoreWithState({
            printer: {
                gcode_move: { absolute_coordinates: false },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.text()).toContain('G91')
    })

    // ── 4. Hides DRO when klipperReadyForGui is false ──
    it('hides DRO when klipperReadyForGui is false', () => {
        mockKlipperReadyForGui.value = false
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const dro = wrapper.find('.topbar-dro')
        expect(dro.exists()).toBe(false)
    })

    // ── 5. Shows save config button when save_config_pending is true ──
    it('shows save config button when save_config_pending is true', () => {
        mockKlipperReadyForGui.value = true
        const store = createStoreWithState({
            printer: {
                configfile: { save_config_pending: true },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        const saveBtn = wrapper.find('.save-config-button')
        expect(saveBtn.exists()).toBe(true)
        expect(wrapper.text()).toContain('App.TopBar.SAVE_CONFIG')
    })

    it('hides save config button when save_config_pending is false', () => {
        mockKlipperReadyForGui.value = true
        const store = createStoreWithState({
            printer: {
                configfile: { save_config_pending: false },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        const saveBtn = wrapper.find('.save-config-button')
        expect(saveBtn.exists()).toBe(false)
    })

    it('hides save config button when klipperReadyForGui is false even if pending', () => {
        mockKlipperReadyForGui.value = false
        const store = createStoreWithState({
            printer: {
                configfile: { save_config_pending: true },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        const saveBtn = wrapper.find('.save-config-button')
        expect(saveBtn.exists()).toBe(false)
    })

    it('disables save config button when printerIsPrinting', () => {
        mockKlipperReadyForGui.value = true
        mockPrinterIsPrinting.value = true
        const store = createStoreWithState({
            printer: {
                configfile: { save_config_pending: true },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        const saveBtn = wrapper.find('.save-config-button')
        expect(saveBtn.attributes('disabled')).toBeDefined()
    })

    it('calls saveConfig when save config button is clicked', async () => {
        mockKlipperReadyForGui.value = true
        const store = createStoreWithState({
            printer: {
                configfile: { save_config_pending: true },
            },
        })
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = mountWithDefaults(TheTopbar, store)

        const saveBtn = wrapper.find('.save-config-button')
        await saveBtn.trigger('click')

        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'SAVE_CONFIG',
            type: 'command',
        })
        expect(mockSocketEmit).toHaveBeenCalledWith(
            'printer.gcode.script',
            {
                script: 'SAVE_CONFIG',
            },
            { loading: 'topbarSaveConfig' }
        )
    })

    // ── 6. Shows upload and print button when conditions met ──
    it('shows upload and print button when conditions met', () => {
        mockKlippyIsConnected.value = true
        mockExistGcodesRootDirectory.value = true
        mockPrinter_state.value = 'standby'
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const uploadBtn = wrapper.find('.upload-and-start-button')
        expect(uploadBtn.exists()).toBe(true)
        expect(wrapper.text()).toContain('App.TopBar.UploadPrint')
    })

    it('hides upload and print when klippy not connected', () => {
        mockKlippyIsConnected.value = false
        mockExistGcodesRootDirectory.value = true
        mockPrinter_state.value = 'standby'
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const uploadBtn = wrapper.find('.upload-and-start-button')
        expect(uploadBtn.exists()).toBe(false)
    })

    it('hides upload and print when existGcodesRootDirectory is false', () => {
        mockKlippyIsConnected.value = true
        mockExistGcodesRootDirectory.value = false
        mockPrinter_state.value = 'standby'
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const uploadBtn = wrapper.find('.upload-and-start-button')
        expect(uploadBtn.exists()).toBe(false)
    })

    it('hides upload and print when printer is in non-standby state (e.g. printing)', () => {
        mockKlippyIsConnected.value = true
        mockExistGcodesRootDirectory.value = true
        mockPrinter_state.value = 'printing'
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const uploadBtn = wrapper.find('.upload-and-start-button')
        expect(uploadBtn.exists()).toBe(false)
    })

    it('hides upload and print when boolHideUploadAndPrintButton is true', () => {
        mockKlippyIsConnected.value = true
        mockExistGcodesRootDirectory.value = true
        mockPrinter_state.value = 'standby'
        const store = createStoreWithState({
            gui: {
                general: { printername: 'MyPrinter' },
                uiSettings: { logo: '#D41216', boolHideUploadAndPrintButton: true },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        const uploadBtn = wrapper.find('.upload-and-start-button')
        expect(uploadBtn.exists()).toBe(false)
    })

    // ── 7. Shows emergency stop button when klippyIsConnected ──
    it('shows emergency stop button when klippyIsConnected', () => {
        mockKlippyIsConnected.value = true
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const emergencyBtn = wrapper.find('.emergency-button')
        expect(emergencyBtn.exists()).toBe(true)
        expect(wrapper.text()).toContain('App.TopBar.EmergencyStop')
    })

    it('hides emergency stop button when klippyIsConnected is false', () => {
        mockKlippyIsConnected.value = false
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const emergencyBtn = wrapper.find('.emergency-button')
        expect(emergencyBtn.exists()).toBe(false)
    })

    it('opens emergency stop dialog when confirmOnEmergencyStop is true', async () => {
        mockKlippyIsConnected.value = true
        const store = createStoreWithState({
            gui: {
                general: { printername: 'MyPrinter' },
                uiSettings: { logo: '#D41216', confirmOnEmergencyStop: true },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        const emergencyBtn = wrapper.find('.emergency-button')
        await emergencyBtn.trigger('click')

        // Dialog should be visible
        const dialog = wrapper.find('.mock-emergency-dialog')
        expect(dialog.exists()).toBe(true)
        // Socket emit should NOT have been called
        expect(mockSocketEmit).not.toHaveBeenCalled()
    })

    it('calls emergencyStop directly when confirmOnEmergencyStop is false', async () => {
        mockKlippyIsConnected.value = true
        const store = createStoreWithState({
            gui: {
                general: { printername: 'MyPrinter' },
                uiSettings: { logo: '#D41216', confirmOnEmergencyStop: false },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        const emergencyBtn = wrapper.find('.emergency-button')
        await emergencyBtn.trigger('click')

        // Socket emit for emergency stop should have been called
        expect(mockSocketEmit).toHaveBeenCalledWith('printer.emergency_stop', {}, { loading: 'topbarEmergencyStop' })
        // Dialog should NOT be visible
        const dialog = wrapper.find('.mock-emergency-dialog')
        expect(dialog.exists()).toBe(false)
    })

    // ── 8. Shows PrinterSelector when countPrinters > 0 ──
    it('shows PrinterSelector when countPrinters > 0', () => {
        const store = createStoreWithState({
            getters: {
                'farm/countPrinters': () => 2,
            },
        } as any)
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.find('.mock-printer-selector').exists()).toBe(true)
    })

    it('hides PrinterSelector when countPrinters is 0', () => {
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.find('.mock-printer-selector').exists()).toBe(false)
    })

    // ── 9. Shows MainsailLogo fallback when sidebarLogo is null ──
    it('shows MainsailLogo fallback when sidebarLogo is null', () => {
        mockSidebarLogo.value = null
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.find('.mock-mainsail-logo').exists()).toBe(true)
        expect(wrapper.find('img.nav-logo').exists()).toBe(false)
    })

    // ── 10. Shows logo image when sidebarLogo is set ──
    it('shows img logo when sidebarLogo is set to non-SVG', () => {
        mockSidebarLogo.value = '/custom/logo.png'
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const logoImg = wrapper.find('img.nav-logo')
        expect(logoImg.exists()).toBe(true)
        expect(logoImg.attributes('src')).toBe('/custom/logo.png')
        expect(wrapper.find('.mock-mainsail-logo').exists()).toBe(false)
    })

    it('shows inline-svg when sidebarLogo is an SVG', () => {
        mockSidebarLogo.value = '/custom/logo.svg'
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        // Should render inline-svg (our mock renders a span with class mock-inline-svg)
        expect(wrapper.find('.mock-inline-svg').exists()).toBe(true)
        expect(wrapper.find('img.nav-logo').exists()).toBe(false)
        expect(wrapper.find('.mock-mainsail-logo').exists()).toBe(false)
    })

    it('shows inline-svg when sidebarLogo has timestamp suffix', () => {
        mockSidebarLogo.value = '/custom/logo.svg?timestamp=12345'
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.find('.mock-inline-svg').exists()).toBe(true)
    })

    // ── 11. Renders child menu components ──
    it('renders TheTopCornerMenu', () => {
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.find('.mock-top-corner').exists()).toBe(true)
    })

    it('renders TheSettingsMenu', () => {
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.find('.mock-settings').exists()).toBe(true)
    })

    it('renders TheNotificationMenu', () => {
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        expect(wrapper.find('.mock-notifications').exists()).toBe(true)
    })

    // ── 12. naviDrawer computed dispatches setNaviDrawer ──
    it('naviDrawer setter dispatches setNaviDrawer', async () => {
        const store = createStoreWithState({ naviDrawer: true })
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = mountWithDefaults(TheTopbar, store)

        // Click nav icon toggles naviDrawer via @click.stop="naviDrawer = !naviDrawer"
        const navIcon = wrapper.find('.v-app-bar-nav-icon')
        await navIcon.trigger('click')

        // Should dispatch setNaviDrawer(false) since initial naviDrawer was true
        expect(dispatchSpy).toHaveBeenCalledWith('setNaviDrawer', false)
    })

    // ── Additional edge cases ──

    it('shows loading state on save config button', () => {
        mockKlipperReadyForGui.value = true
        mockLoadings.value = ['topbarSaveConfig']
        const store = createStoreWithState({
            printer: {
                configfile: { save_config_pending: true },
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        const saveBtn = wrapper.find('.save-config-button')
        expect(saveBtn.classes()).toContain('v-btn--loading')
    })

    it('shows loading state on emergency stop button', () => {
        mockKlippyIsConnected.value = true
        mockLoadings.value = ['topbarEmergencyStop']
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const emergencyBtn = wrapper.find('.emergency-button')
        expect(emergencyBtn.classes()).toContain('v-btn--loading')
    })

    it('shows upload snackbar when upload is in progress', async () => {
        mockKlippyIsConnected.value = true
        mockExistGcodesRootDirectory.value = true
        mockPrinter_state.value = 'standby'
        const store = createStoreWithState()
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        // Keep upload in progress - never resolve so snackbar stays visible
        const axios = await import('axios')
        let resolveUpload: (value: any) => void
        ;(axios.default.post as any).mockImplementation((_url: string, _data: any, config: any) => {
            // Trigger progress callback
            if (config.onUploadProgress) {
                config.onUploadProgress({
                    progress: 0.5,
                    rate: 102400,
                    total: 1024,
                })
            }
            return new Promise((resolve) => {
                resolveUpload = resolve
            })
        })

        const wrapper = mountWithDefaults(TheTopbar, store)

        // Click upload-and-start button
        const uploadBtn = wrapper.find('.upload-and-start-button')
        await uploadBtn.trigger('click')

        // Set up file on hidden input and trigger change
        const fileInput = wrapper.find('input[type="file"]')
        const file = new File(['gcode content'], 'test.gcode', { type: 'text/plain' })
        Object.defineProperty(fileInput.element, 'files', {
            value: [file],
            writable: false,
        })
        await fileInput.trigger('change')

        // Flush pending promises to let the upload start
        await new Promise((r) => setTimeout(r, 0))

        // Snackbar should be visible during upload
        const snackbar = wrapper.find('.v-snackbar')
        expect(snackbar.exists()).toBe(true)
        expect(wrapper.text()).toContain('App.TopBar.Uploading')

        expect(dispatchSpy).toHaveBeenCalledWith('socket/addLoading', {
            name: 'btnUploadAndStart',
        })

        // Resolve upload to complete it
        resolveUpload!({ data: { result: 'test.gcode' } })
        await new Promise((r) => setTimeout(r, 0))

        // After completion, snackbar should close
        expect(dispatchSpy).toHaveBeenCalledWith('socket/removeLoading', {
            name: 'btnUploadAndStart',
        })

        expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('App.TopBar.UploadOfFileSuccessful'))
    })

    it('handles upload failure gracefully', async () => {
        mockKlippyIsConnected.value = true
        mockExistGcodesRootDirectory.value = true
        mockPrinter_state.value = 'standby'
        const store = createStoreWithState()

        const axios = await import('axios')
        ;(axios.default.post as any).mockRejectedValue(new Error('Upload failed'))

        const wrapper = mountWithDefaults(TheTopbar, store)

        const uploadBtn = wrapper.find('.upload-and-start-button')
        await uploadBtn.trigger('click')

        const fileInput = wrapper.find('input[type="file"]')
        const file = new File(['gcode content'], 'test.gcode', { type: 'text/plain' })
        Object.defineProperty(fileInput.element, 'files', {
            value: [file],
            writable: false,
        })

        await fileInput.trigger('change')

        // Flush promises to let the rejection propagate
        await new Promise((r) => setTimeout(r, 0))

        // Should show error toast
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('App.TopBar.CannotUploadTheFile'))
    })

    it('gcode input accept is empty on iOS', () => {
        mockIsIOS.value = true
        const store = createStoreWithState()
        const wrapper = mountWithDefaults(TheTopbar, store)

        const fileInput = wrapper.find('input[type="file"]')
        expect(fileInput.attributes('accept')).toBe('')
    })

    it('shows unhomed axis labels correctly', () => {
        mockKlipperReadyForGui.value = true
        const store = createStoreWithState({
            printer: {
                toolhead: { homed_axes: 'x' }, // only x is homed
            },
        })
        const wrapper = mountWithDefaults(TheTopbar, store)

        // DRO should still render but some axes are unhomed
        const dro = wrapper.find('.topbar-dro')
        expect(dro.exists()).toBe(true)
    })

    it('handles onMounted defaultNavigationStateSetting alwaysClosed', () => {
        const store = createStoreWithState({
            gui: {
                general: { printername: 'MyPrinter' },
                uiSettings: { logo: '#D41216', defaultNavigationStateSetting: 'alwaysClosed' },
            },
        })
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        mountWithDefaults(TheTopbar, store)

        expect(dispatchSpy).toHaveBeenCalledWith('setNaviDrawer', false)
    })

    it('handles onMounted defaultNavigationStateSetting lastState', () => {
        localStorage.setItem('naviDrawer', 'false')

        const store = createStoreWithState({
            gui: {
                general: { printername: 'MyPrinter' },
                uiSettings: { logo: '#D41216', defaultNavigationStateSetting: 'lastState' },
            },
        })
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        mountWithDefaults(TheTopbar, store)

        expect(dispatchSpy).toHaveBeenCalledWith('setNaviDrawer', false)
    })

    it('handles onMounted defaultNavigationStateSetting alwaysOpen', () => {
        mockLgAndUp.value = true
        const store = createStoreWithState({
            gui: {
                general: { printername: 'MyPrinter' },
                uiSettings: { logo: '#D41216', defaultNavigationStateSetting: 'alwaysOpen' },
            },
        })
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        mountWithDefaults(TheTopbar, store)

        // alwaysOpen: naviDrawer = display.lgAndUp.value (true)
        expect(dispatchSpy).toHaveBeenCalledWith('setNaviDrawer', true)
    })
})
