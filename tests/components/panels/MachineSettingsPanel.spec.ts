import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import MachineSettingsPanel from '@/components/panels/MachineSettingsPanel.vue'

const mockKlipperReadyForGui = vi.hoisted(() => {
    class MockRef { _value: any; __v_isRef = true; constructor(v: any) { this._value = v } get value() { return this._value } set value(v) { this._value = v } }
    return new MockRef(true)
})
const mockDoSend = vi.fn()

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: mockKlipperReadyForGui,
    }),
}))

vi.mock('@/composables/useControl', () => ({
    useControl: () => ({
        doSend: mockDoSend,
    }),
}))

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], collapsible: Boolean, cardClass: String, toolbarColor: String },
        template: '<div v-if="true" class="panel" :class="cardClass"><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('@/components/inputs/NumberInput.vue', () => ({
    default: {
        name: 'NumberInput',
        props: ['label', 'param', 'target', 'defaultValue', 'unit', 'hasSpinner', 'step', 'min', 'max', 'dec', 'spinnerFactor'],
        template: '<div class="number-input-stub">{{ param }}: {{ target }} {{ unit }}</div>',
        emits: ['submit'],
    },
}))

vi.mock('@/components/ui/Responsive.vue', () => ({
    default: {
        name: 'Responsive',
        props: ['breakpoints'],
        template: '<div class="responsive-stub"><slot :el="{ is: { small: false, medium: true }, width: 400 }" /></div>',
    },
}))

describe('MachineSettingsPanel.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        mockKlipperReadyForGui.value = true
        store = createStore({
            state: {
                printer: {
                    toolhead: {
                        max_velocity: 500,
                        max_accel: 5000,
                        max_accel_to_decel: 2500,
                        square_corner_velocity: 5.0,
                    },
                    configfile: {
                        settings: {
                            printer: {
                                max_velocity: 500,
                                max_accel: 5000,
                                max_accel_to_decel: 2500,
                                square_corner_velocity: 5.0,
                                minimum_cruise_ratio: 0.5,
                            },
                        },
                    },
                },
            },
        })
    })

    it('renders when klipperReadyForGui is true', () => {
        const wrapper = mount(MachineSettingsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('does NOT render when klipperReadyForGui is false', () => {
        mockKlipperReadyForGui.value = false
        const wrapper = mount(MachineSettingsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('renders the panel title', () => {
        const wrapper = mount(MachineSettingsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel-title').text()).toContain('Panels.MachineSettingsPanel.Headline')
    })

    it('renders number inputs', () => {
        const wrapper = mount(MachineSettingsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const inputs = wrapper.findAllComponents({ name: 'NumberInput' })
        expect(inputs.length).toBeGreaterThanOrEqual(3)
        const velocityInput = inputs.find((i) => i.props('param') === 'VELOCITY')
        expect(velocityInput).toBeDefined()
        expect(velocityInput!.props('target')).toBe(500)
    })

    it('passes correct unit to number inputs', () => {
        const wrapper = mount(MachineSettingsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const inputs = wrapper.findAllComponents({ name: 'NumberInput' })
        expect(inputs.find((i) => i.props('param') === 'VELOCITY')!.props('unit')).toBe('mm/s')
        expect(inputs.find((i) => i.props('param') === 'ACCEL')!.props('unit')).toBe('mm/s²')
    })

    it('shows ACCEL_TO_DECEL when minimumCruiseRatio is null', () => {
        store.state.printer.toolhead.minimum_cruise_ratio = null
        delete store.state.printer.configfile.settings.printer.minimum_cruise_ratio
        const wrapper = mount(MachineSettingsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const inputs = wrapper.findAllComponents({ name: 'NumberInput' })
        expect(inputs.find((i) => i.props('param') === 'ACCEL_TO_DECEL')).toBeDefined()
    })

    it('shows MINIMUM_CRUISE_RATIO when minimumCruiseRatio is not null', () => {
        store.state.printer.toolhead.minimum_cruise_ratio = 0.5
        store.state.printer.configfile.settings.printer.minimum_cruise_ratio = 0.5
        const wrapper = mount(MachineSettingsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const inputs = wrapper.findAllComponents({ name: 'NumberInput' })
        expect(inputs.find((i) => i.props('param') === 'MINIMUM_CRUISE_RATIO')).toBeDefined()
    })

    it('handles missing toolhead data gracefully', () => {
        store.state.printer.toolhead = {}
        const wrapper = mount(MachineSettingsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('renders Responsive component', () => {
        const wrapper = mount(MachineSettingsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.findComponent({ name: 'Responsive' }).exists()).toBe(true)
    })
})
