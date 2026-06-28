import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import MacrogroupPanel from '@/components/panels/MacrogroupPanel.vue'

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
const mockPrinterState = vi.hoisted(() => {
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
    return new MockRef('standby')
})

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: mockKlipperReadyForGui,
        printer_state: mockPrinterState,
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
        props: { icon: String, title: [String, Object], collapsible: Boolean, cardClass: String },
        template: '<div class="panel" :class="cardClass"><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('@/components/inputs/MacroButton.vue', () => ({
    default: {
        name: 'MacroButton',
        props: ['macro', 'color'],
        template: '<button class="macro-button-stub">{{ macro?.name }}</button>',
    },
}))

describe('MacrogroupPanel.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        mockKlipperReadyForGui.value = true
        mockPrinterState.value = 'standby'

        store = createStore({
            state: {
                printer: { printer_state: 'standby' },
                gui: { macros: { macrogroups: {} } },
            },
            getters: {
                'gui/macros/getMacrogroup': () => (panelId: string) => {
                    if (panelId === 'test-group') {
                        return {
                            name: 'My Macros',
                            color: 'primary',
                            showInStandby: true,
                            showInPause: false,
                            showInPrinting: false,
                            macros: [
                                {
                                    name: 'G28',
                                    pos: 1,
                                    color: 'primary',
                                    showInStandby: true,
                                    showInPause: false,
                                    showInPrinting: false,
                                },
                                {
                                    name: 'M84',
                                    pos: 2,
                                    color: 'primary',
                                    showInStandby: true,
                                    showInPause: false,
                                    showInPrinting: false,
                                },
                            ],
                        }
                    }
                    return null
                },
                'printer/getMacros': () => [{ name: 'G28' }, { name: 'M84' }],
            },
        })
    })

    it('renders when klipperReadyForGui is true and macrogroup exists', () => {
        const wrapper = mount(MacrogroupPanel, {
            props: { panelId: 'test-group' },
            global: { plugins: [store] },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('renders the macrogroup name as panel title', () => {
        const wrapper = mount(MacrogroupPanel, {
            props: { panelId: 'test-group' },
            global: { plugins: [store] },
        })
        expect(wrapper.find('.panel-title').text()).toBe('My Macros')
    })

    it('does NOT render when klipperReadyForGui is false', () => {
        mockKlipperReadyForGui.value = false
        const wrapper = mount(MacrogroupPanel, {
            props: { panelId: 'test-group' },
            global: { plugins: [store] },
        })
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('does NOT render when macrogroup has no macros', () => {
        store = createStore({
            state: { printer: {}, gui: { macros: { macrogroups: {} } } },
            getters: {
                'gui/macros/getMacrogroup': () => () => ({
                    name: 'Empty',
                    macros: [],
                    color: 'primary',
                    showInStandby: true,
                    showInPause: false,
                    showInPrinting: false,
                }),
                'printer/getMacros': () => [],
            },
        })
        const wrapper = mount(MacrogroupPanel, {
            props: { panelId: 'empty-group' },
            global: { plugins: [store] },
        })
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('renders MacroButton for each macro', () => {
        const wrapper = mount(MacrogroupPanel, {
            props: { panelId: 'test-group' },
            global: { plugins: [store] },
        })
        const buttons = wrapper.findAllComponents({ name: 'MacroButton' })
        expect(buttons.length).toBe(2)
        expect(buttons[0].props('macro').name).toBe('G28')
        expect(buttons[1].props('macro').name).toBe('M84')
    })

    it('sorts macros by pos', () => {
        store = createStore({
            state: { printer: { printer_state: 'standby' }, gui: { macros: { macrogroups: {} } } },
            getters: {
                'gui/macros/getMacrogroup': () => () => ({
                    name: 'Sorted',
                    color: 'primary',
                    showInStandby: true,
                    showInPause: false,
                    showInPrinting: false,
                    macros: [
                        {
                            name: 'M84',
                            pos: 2,
                            color: 'primary',
                            showInStandby: true,
                            showInPause: false,
                            showInPrinting: false,
                        },
                        {
                            name: 'G28',
                            pos: 1,
                            color: 'primary',
                            showInStandby: true,
                            showInPause: false,
                            showInPrinting: false,
                        },
                    ],
                }),
                'printer/getMacros': () => [{ name: 'G28' }, { name: 'M84' }],
            },
        })
        const wrapper = mount(MacrogroupPanel, {
            props: { panelId: 'sorted-group' },
            global: { plugins: [store] },
        })
        const buttons = wrapper.findAllComponents({ name: 'MacroButton' })
        expect(buttons[0].props('macro').name).toBe('G28')
        expect(buttons[1].props('macro').name).toBe('M84')
    })
})
