import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'
import JogPanel from '@/components/panels/Cnc/JogPanel.vue'

// Mock Panel
vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], collapsible: Boolean, cardClass: String },
        template: '<div class="panel" :class="cardClass"><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

// Mock composables
const mockKlipperReadyForGui = ref(true)
const mockPrinterState = ref('ready')
const mockSocketIsConnected = ref(true)
const mockHomedAxes = ref('xyz')
const mockDoHome = vi.fn()
const mockDoHomeXY = vi.fn()
const mockDoHomeZ = vi.fn()
const mockDoSend = vi.fn()

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: mockKlipperReadyForGui,
        printer_state: mockPrinterState,
        socketIsConnected: mockSocketIsConnected,
    }),
}))

vi.mock('@/composables/useControl', () => ({
    useControl: () => ({
        homedAxes: mockHomedAxes,
        doHome: mockDoHome,
        doHomeXY: mockDoHomeXY,
        doHomeZ: mockDoHomeZ,
        doSend: mockDoSend,
    }),
}))

const mockSocketEmit = vi.fn()
vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mockSocketEmit }),
}))

const mockToastError = vi.fn()
const mockToastWarning = vi.fn()
const mockDismiss = vi.fn()
vi.mock('vue-toast-notification', () => ({
    useToast: () => ({
        error: mockToastError,
        warning: (msg: string, _opts: any) => {
            mockToastWarning(msg, _opts)
            return { dismiss: mockDismiss }
        },
    }),
}))

vi.mock('@/store/files/cncApi', () => ({
    updateCncSettings: vi.fn().mockResolvedValue(undefined),
}))
import { updateCncSettings } from '@/store/files/cncApi'

function createStoreInstance() {
    return createStore({
        state: {
            server: { loadings: [], klippy_connected: true, klippy_state: 'ready' },
            gui: {
                control: {
                    selectedCncStepIndex: 2,
                    cncFeedrateXY: 500,
                    cncFeedrateZ: 100,
                },
            },
            printer: {
                toolhead: { max_velocity: 1000 },
                gcode_move: { speed_factor: 1 },
            },
            socket: { isConnected: true, initializationList: [], loadings: [] },
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
        },
        actions: {
            'gui/saveSetting': vi.fn(),
        },
    })
}

describe('JogPanel.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKlipperReadyForGui.value = true
        mockPrinterState.value = 'ready'
        mockSocketIsConnected.value = true
        mockHomedAxes.value = 'xyz'
    })

    it('renders nothing when klipperReadyForGui is false', () => {
        mockKlipperReadyForGui.value = false
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        expect(wrapper.find('.jog-panel').exists()).toBe(false)
    })

    it('renders panel with title and home buttons', () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        expect(wrapper.text()).toContain('Jog')
        expect(wrapper.text()).toContain('Home All')
        expect(wrapper.text()).toContain('Home XY')
        expect(wrapper.text()).toContain('Home Z')
        expect(wrapper.text()).toContain('Disable Steppers')
    })

    it('calls doHome when Home All clicked', async () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        const buttons = wrapper.findAll('button.v-btn')
        const homeBtn = buttons.find((b) => b.text().includes('Home All'))
        await homeBtn!.trigger('click')
        expect(mockDoHome).toHaveBeenCalled()
    })

    it('calls doHomeXY and doHomeZ', async () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        const buttons = wrapper.findAll('button.v-btn')
        const xyBtn = buttons.find((b) => b.text().includes('Home XY'))
        const zBtn = buttons.find((b) => b.text().includes('Home Z'))
        await xyBtn!.trigger('click')
        await zBtn!.trigger('click')
        expect(mockDoHomeXY).toHaveBeenCalled()
        expect(mockDoHomeZ).toHaveBeenCalled()
    })

    it('calls disable steppers', async () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        const buttons = wrapper.findAll('button.v-btn')
        const btn = buttons.find((b) => b.text().includes('Disable Steppers'))
        await btn!.trigger('click')
        expect(mockDoSend).toHaveBeenCalledWith('M18')
    })

    it('sends jog gcode for Z up', async () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        const upBtns = wrapper.findAll('button.v-btn').filter((b) => b.text().includes('up'))
        expect(upBtns.length).toBeGreaterThanOrEqual(1)
        await upBtns[0].trigger('click')
        expect(mockSocketEmit).toHaveBeenCalled()
        const args = mockSocketEmit.mock.calls[0]
        expect(args[0]).toBe('printer.gcode.script')
        expect(args[1].script).toContain('G1 Z')
    })

    it('shows error toast when jogging without connection', async () => {
        mockSocketIsConnected.value = false
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        const upBtns = wrapper.findAll('button.v-btn').filter((b) => b.text().includes('up'))
        await upBtns[0].trigger('click')
        expect(mockToastError).toHaveBeenCalledWith('Cannot jog — not connected to printer')
        expect(mockSocketEmit).not.toHaveBeenCalled()
    })

    it('shows printer state and homed status', () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        expect(wrapper.text()).toContain('ready')
        expect(wrapper.text()).toContain('All')
    })

    it('shows "None" when no axes homed', () => {
        mockHomedAxes.value = ''
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        expect(wrapper.text()).toContain('None')
    })

    it('renders jog step buttons', () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        const stepBtns = wrapper.findAll('button.v-btn').filter((b) => b.text().includes('mm'))
        expect(stepBtns.length).toBeGreaterThanOrEqual(7)
    })

    it('toggles keyboard navigation', async () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        const keyboardBtn = wrapper.findAll('button.v-btn').find((b) => b.text().includes('Keyboard Nav'))
        expect(keyboardBtn!.text()).toContain('OFF')
        await keyboardBtn!.trigger('click')
        expect(mockToastWarning).toHaveBeenCalled()
    })

    it('saves feedrates on change', async () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        const inputs = wrapper.findAll('input.v-text-field')
        if (inputs.length > 0) {
            await inputs[0].trigger('change')
            expect(updateCncSettings).toHaveBeenCalled()
        }
    })

    it('renders all sections: XY jog, Z jog, Feedrate Override, Keyboard Nav', () => {
        const wrapper = mount(JogPanel, {
            global: {
                plugins: [createStoreInstance()],
                stubs: {
                    VContainer: { template: '<div class="v-container"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>' },
                    VIcon: { template: '<i><slot /></i>' },
                    VBtnToggle: { template: '<div class="v-btn-toggle"><slot /></div>' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSpacer: { template: '<span />' },
                    VChip: { template: '<span class="v-chip"><slot /></span>' },
                    VDivider: { template: '<hr />' },
                },
            },
        })
        expect(wrapper.text()).toContain('XY Jog')
        expect(wrapper.text()).toContain('Z Jog')
        expect(wrapper.text()).toContain('Feedrate Override')
        expect(wrapper.text()).toContain('Keyboard Nav')
    })
})
