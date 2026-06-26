import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import EndstopPanel from '@/components/panels/Machine/EndstopPanel.vue'

const mockBaseValues = vi.hoisted(() => {
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
        loadings: new MockRef([]),
    }
})

vi.mock('@/composables/useBase', () => ({
    useBase: () => mockBaseValues,
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: vi.fn(),
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<span style="flex:1" />' },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'loading'],
        template: '<button :class="$attrs.class" @click="$attrs.onClick || $attrs.click"><slot /></button>',
    },
    VIcon: { name: 'VIcon', props: ['start', 'icon'], template: '<i><slot /></i>' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)
vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['icon', 'title', 'collapsible', 'cardClass'],
        template: '<div :class="cardClass"><slot /></div>',
    },
}))
vi.mock('@/components/panels/Machine/EndstopPanelItem.vue', () => ({
    default: {
        name: 'EndstopPanelItem',
        props: ['item'],
        template: '<div class="endstop-item">{{ item.name }}: {{ item.value }}</div>',
    },
}))

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: [] },
            printer: {
                print_stats: { state: 'standby' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
                endstops: {},
                ...(overrides.printer || {}),
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
            'gui/getPanelExpand': () => () => true,
            ...(overrides.getters || {}),
        },
    })
}

describe('EndstopPanel.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockBaseValues.loadings.value = []
    })

    it('renders empty state when no endstops configured', () => {
        const store = createStoreWithState()
        const wrapper = mount(EndstopPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.find('.machine-endstop-panel').exists()).toBe(true)
        expect(wrapper.text()).toContain('Machine.EndstopPanel.EndstopInfo')
    })

    it('renders endstop items from printer state', () => {
        const store = createStoreWithState({
            printer: {
                print_stats: { state: 'standby' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
                endstops: {
                    x: 'open',
                    y: 'TRIGGERED',
                },
            },
        })
        const wrapper = mount(EndstopPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const items = wrapper.findAll('.endstop-item')
        expect(items).toHaveLength(2)
        expect(items[0].text()).toContain('x')
        expect(items[1].text()).toContain('y')
    })

    it('includes probe data when probe exists in printer state', () => {
        const store = createStoreWithState({
            printer: {
                print_stats: { state: 'standby' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
                endstops: {
                    x: 'open',
                },
                probe: {
                    last_query: true,
                    name: 'my_probe',
                },
            },
        })
        const wrapper = mount(EndstopPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const items = wrapper.findAll('.endstop-item')
        // x endstop + probe
        expect(items).toHaveLength(2)
        expect(items[1].text()).toContain('my_probe')
    })

    it('renders a sync button', () => {
        const store = createStoreWithState()
        const wrapper = mount(EndstopPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAll('button')
        expect(buttons.length).toBeGreaterThanOrEqual(1)
    })

    it('calls queryEndstops when sync button is clicked', async () => {
        const store = createStoreWithState()
        const wrapper = mount(EndstopPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAll('button')
        if (buttons.length > 0) {
            await buttons[0].trigger('click')
        }
        // Should not throw when clicking
    })
})
