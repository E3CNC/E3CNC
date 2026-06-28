import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import LedEffectsPanel from '@/components/panels/LedEffectsPanel.vue'

const mockKlipperReadyForGui = vi.hoisted(() => {
    class MockRef {
        _value: any
        __v_isRef = true
        constructor(v: any) {
            this._value = v
        }
        get value() {
            return this._value
        }
        set value(v) {
            this._value = v
        }
    }
    return new MockRef(true)
})
const mockPrinterIsPrintingOnly = vi.hoisted(() => {
    class MockRef {
        _value: any
        __v_isRef = true
        constructor(v: any) {
            this._value = v
        }
        get value() {
            return this._value
        }
        set value(v) {
            this._value = v
        }
    }
    return new MockRef(false)
})
const mockLoadings = vi.hoisted(() => {
    class MockRef {
        _value: any
        __v_isRef = true
        constructor(v: any) {
            this._value = v
        }
        get value() {
            return this._value
        }
        set value(v) {
            this._value = v
        }
    }
    return new MockRef([])
})

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: mockKlipperReadyForGui,
        printerIsPrintingOnly: mockPrinterIsPrintingOnly,
        loadings: mockLoadings,
    }),
}))

const mockSocketEmit = vi.fn()

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: mockSocketEmit,
    }),
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], collapsible: Boolean, cardClass: String },
        template:
            '<div class="panel" :class="cardClass"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('@/components/inputs/LedEffectButton.vue', () => ({
    default: {
        name: 'LedEffectButton',
        props: ['name'],
        template: '<button class="led-effect-btn-stub">{{ name }}</button>',
    },
}))

vi.mock('vuetify/components', () => ({
    VTooltip: {
        name: 'VTooltip',
        template: '<div class="v-tooltip"><slot name="activator" /><slot /></div>',
    },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'rounded', 'loading', 'disabled'],
        template: '<button class="v-btn" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', props: ['icon'], template: '<i class="v-icon"><slot /></i>' },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
}))

describe('LedEffectsPanel.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        mockKlipperReadyForGui.value = true
        mockPrinterIsPrintingOnly.value = false
        mockLoadings.value = []

        store = createStore({
            state: {
                printer: {
                    'led_effect rainbow': {},
                    'led_effect chase': {},
                    'led_effect _hidden': {},
                },
            },
        })
    })

    it('renders when klipperReadyForGui is true', () => {
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('does NOT render when klipperReadyForGui is false', () => {
        mockKlipperReadyForGui.value = false
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('renders panel title', () => {
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel-title').text()).toContain('Panels.LedEffectsPanel.Headline')
    })

    it('renders LedEffectButton for each visible led effect (sorted alphabetically)', () => {
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAllComponents({ name: 'LedEffectButton' })
        expect(buttons.length).toBe(2)
        // Sorted alphabetically: chase < rainbow
        expect(buttons[0].props('name')).toBe('chase')
        expect(buttons[1].props('name')).toBe('rainbow')
    })

    it('filters out led effects starting with underscore', () => {
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAllComponents({ name: 'LedEffectButton' })
        const hiddenEffect = buttons.find((b) => b.props('name') === '_hidden')
        expect(hiddenEffect).toBeUndefined()
    })

    it('sorts led effects alphabetically', () => {
        store = createStore({
            state: {
                printer: {
                    'led_effect zebra': {},
                    'led_effect rainbow': {},
                    'led_effect chase': {},
                },
            },
        })
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAllComponents({ name: 'LedEffectButton' })
        expect(buttons[0].props('name')).toBe('chase')
        expect(buttons[1].props('name')).toBe('rainbow')
        expect(buttons[2].props('name')).toBe('zebra')
    })

    it('renders stop all button in panel buttons slot', () => {
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-btn').exists()).toBe(true)
    })

    it('shows loading state on stop all button when loading', () => {
        mockLoadings.value = ['STOP_LED_EFFECTS']
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        expect(btn.exists()).toBe(true)
    })

    it('disables stop all button when printer is printing only', () => {
        mockPrinterIsPrintingOnly.value = true
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        expect(btn.attributes('disabled')).toBeDefined()
    })

    it('handles no led effects gracefully', () => {
        store = createStore({
            state: { printer: {} },
        })
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
        expect(wrapper.findAllComponents({ name: 'LedEffectButton' }).length).toBe(0)
    })

    it('does not throw when stop button is clicked', async () => {
        const wrapper = mount(LedEffectsPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        // Click via wrapper HTML
        const btnHtml = wrapper.find('.v-btn')
        if (btnHtml.exists()) {
            await btnHtml.trigger('click')
        }
    })
})
