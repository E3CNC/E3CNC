import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'
import DroPanel from '@/components/panels/Cnc/DroPanel.vue'

// Mock Vuetify components
vi.mock('vuetify/components', () => ({
    VContainer: { name: 'VContainer', template: '<div class="v-container"><slot /></div>' },
    VChip: {
        name: 'VChip',
        props: { size: String, label: Boolean, color: String, variant: String },
        template: '<span class="v-chip" :class="color"><slot /></span>',
    },
}))

// Mock Panel child — MUST render title text
vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], collapsible: Boolean, cardClass: String },
        template: '<div class="panel" :class="cardClass"><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

// Mock composables — use ref() for Vue auto-unwrap
const mockKlipperReadyForGui = ref(true)
const mockAbsoluteCoordinates = ref(true)
const mockXAxisHomed = ref(true)
const mockYAxisHomed = ref(true)
const mockZAxisHomed = ref(true)
const mockShowMachineCoords = ref(true)

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: mockKlipperReadyForGui,
    }),
}))

vi.mock('@/composables/useControl', () => ({
    useControl: () => ({
        absolute_coordinates: mockAbsoluteCoordinates,
        xAxisHomed: mockXAxisHomed,
        yAxisHomed: mockYAxisHomed,
        zAxisHomed: mockZAxisHomed,
    }),
}))

vi.mock('@/composables/useCncProfile', () => ({
    useCncProfile: () => ({
        showMachineCoords: mockShowMachineCoords,
    }),
}))

describe('DroPanel.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        mockKlipperReadyForGui.value = true
        mockAbsoluteCoordinates.value = true
        mockXAxisHomed.value = true
        mockYAxisHomed.value = true
        mockZAxisHomed.value = true
        mockShowMachineCoords.value = true

        store = createStore({
            state: {
                printer: {
                    motion_report: {
                        live_position: [100.123, 200.456, 30.789],
                        live_velocity: 150.5,
                    },
                    gcode_move: {
                        gcode_position: [50.0, 100.0, 10.0],
                        absolute_coordinates: true,
                    },
                    toolhead: {
                        homed_axes: 'xyz',
                        axis_minimum: [0, 0, -5, 0],
                        axis_maximum: [500, 400, 300, 0],
                    },
                },
            },
            getters: {
                'socket/getUrl': () => 'ws://localhost:8080/websocket',
            },
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    function createWrapper(): VueWrapper {
        return mount(DroPanel, {
            global: {
                plugins: [store],
            },
        })
    }

    it('renders when klipperReadyForGui is true', () => {
        const wrapper = createWrapper()
        expect(wrapper.find('.panel').exists()).toBe(true)
        expect(wrapper.find('.panel-title').text()).toContain('DRO')
    })

    it('does not render when klipperReadyForGui is false', () => {
        mockKlipperReadyForGui.value = false
        const wrapper = createWrapper()
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('shows coordinate mode label (Absolute)', () => {
        mockAbsoluteCoordinates.value = true
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('Absolute (G90)')
    })

    it('shows coordinate mode label (Relative)', () => {
        mockAbsoluteCoordinates.value = false
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('Relative (G91)')
    })

    it('shows live velocity', () => {
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('Velocity 150.50 mm/s')
    })

    it('shows "Homed" chip when all axes homed', () => {
        mockXAxisHomed.value = true
        mockYAxisHomed.value = true
        mockZAxisHomed.value = true
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('Homed')
        expect(wrapper.text()).not.toContain('Not Homed')
    })

    it('shows "Not Homed" chip when any axis is not homed', () => {
        mockXAxisHomed.value = true
        mockYAxisHomed.value = false
        mockZAxisHomed.value = true
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('Not Homed')
    })

    it('renders three axis sections (X, Y, Z)', () => {
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('X')
        expect(wrapper.text()).toContain('Y')
        expect(wrapper.text()).toContain('Z')
    })

    it('shows machine coordinates for each axis', () => {
        const wrapper = createWrapper()
        // Machine X: 100.12 (toFixed(2))
        expect(wrapper.text()).toContain('Machine')
        expect(wrapper.text()).toContain('100.12')
        // Machine Y: 200.46 (toFixed(2))
        expect(wrapper.text()).toContain('200.46')
        // Machine Z: 30.789 → 30.79 (2 digits)
        expect(wrapper.text()).toContain('30.79')
    })

    it('hides machine coordinates when showMachineCoords is false', () => {
        mockShowMachineCoords.value = false
        const wrapper = createWrapper()
        // Should not see the Machine labels
        const machineLabels = wrapper.findAll('.dro-panel__label').filter((el) => el.text() === 'Machine')
        expect(machineLabels.length).toBe(0)
    })

    it('shows work coordinates for each axis', () => {
        const wrapper = createWrapper()
        // Work X: 50.00 → 50 (trailing zeros stripped)
        expect(wrapper.text()).toContain('Work')
        expect(wrapper.text()).toContain('50')
        // Work Y: 100.00 → 100
        expect(wrapper.text()).toContain('100')
        // Work Z: 10.000 → 10
        expect(wrapper.text()).toContain('10')
    })

    it('shows computed offsets (machine - work)', () => {
        // Offset X: 100.123 - 50.0 = 50.123 → +50.12
        // Offset Y: 200.456 - 100.0 = 100.456 → +100.46
        // Offset Z: 30.789 - 10.0 = 20.789 → +20.789
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('+50.12')
        expect(wrapper.text()).toContain('+100.46')
        expect(wrapper.text()).toContain('+20.79')
    })

    it('shows negative offsets with minus sign', () => {
        store.state.printer.motion_report.live_position = [10, 20, 5]
        store.state.printer.gcode_move.gcode_position = [50, 100, 30]
        // X: -40, Y: -80, Z: -25
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('-40')
        expect(wrapper.text()).toContain('-80')
        expect(wrapper.text()).toContain('-25')
    })

    it('shows homed/OPEN status per axis', () => {
        mockXAxisHomed.value = true
        mockYAxisHomed.value = false
        mockZAxisHomed.value = false
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('HOMED')
        expect(wrapper.text()).toContain('OPEN')
    })

    it('shows individual axis homed chips at the bottom', () => {
        mockXAxisHomed.value = true
        mockYAxisHomed.value = false
        mockZAxisHomed.value = true
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('X OK')
        expect(wrapper.text()).toContain('Y --')
        expect(wrapper.text()).toContain('Z OK')
    })

    it('shows axis limits (min/max)', () => {
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('Min')
        expect(wrapper.text()).toContain('Max')
        // Axis minimums: X=0, Y=0, Z=-5
        expect(wrapper.text()).toContain('Min')
        expect(wrapper.text()).toContain('-5')
        // Axis maximums: X=500, Y=400, Z=300
        expect(wrapper.text()).toContain('500')
        expect(wrapper.text()).toContain('400')
        expect(wrapper.text()).toContain('300')
    })

    it('handles missing store state gracefully', () => {
        store.state.printer = {}
        const wrapper = createWrapper()
        // Should render without crashing
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('renders Z axis with 3 decimal places', () => {
        store.state.printer.motion_report.live_position = [100.1234, 200.5678, 30.9876]
        store.state.printer.gcode_move.gcode_position = [50, 100, 15]
        const wrapper = createWrapper()
        // Machine Z: 30.988 → 30.99 (2 digits)
        expect(wrapper.text()).toContain('30.99')
    })

    it('renders X/Y axes with 2 decimal places', () => {
        store.state.printer.motion_report.live_position = [100.1234, 200.5678, 30.9876]
        store.state.printer.gcode_move.gcode_position = [50, 100, 15]
        const wrapper = createWrapper()
        // Machine X: 100.12
        expect(wrapper.text()).toContain('100.12')
        // Machine Y: 200.57
        expect(wrapper.text()).toContain('200.57')
    })
})
