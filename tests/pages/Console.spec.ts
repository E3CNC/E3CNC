import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'

// --- Mock ref utility ---

const consoleScrollMock = vi.hoisted(() => ({
    osInstance: vi.fn(() => ({
        scroll: vi.fn(),
    })),
    scroll: vi.fn(),
}))

const mockConsoleValues = vi.hoisted(() => {
    class MockRef<T> {
        _value: T
        __v_isRef = true
        __v_isShallow = false

        constructor(val: T) {
            this._value = val
        }

        get value() {
            return this._value
        }

        set value(v: T) {
            this._value = v
        }
    }

    return {
        consoleDirection: new MockRef<string>('shell'),
        autoscroll: new MockRef<boolean>(true),
        hideWaitTemperatures: new MockRef<boolean>(false),
        hideTlCommands: new MockRef<boolean>(false),
        customFilters: new MockRef<Record<string, any>>({}),
        rawOutput: new MockRef<boolean>(false),
        moonrakerComponents: new MockRef<string[]>([]),
        clearConsole: vi.fn(),
        commandClick: vi.fn(),
        toggleFilter: vi.fn(),
        gcodeSetGcode: vi.fn(),
    }
})

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

// Mock vuetify/components
vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        template: '<button class="v-btn" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', template: '<span class="v-icon"><slot /></span>' },
    VMenu: {
        name: 'VMenu',
        template: '<div class="v-menu"><slot name="activator" /><slot /></div>',
    },
    VList: { name: 'VList', template: '<div class="v-list"><slot /></div>' },
    VListItem: { name: 'VListItem', template: '<div class="v-list-item"><slot /></div>' },
    VCheckbox: {
        name: 'VCheckbox',
        props: ['modelValue', 'label', 'hideDetails'],
        template:
            '<label class="v-checkbox"><input type="checkbox" :checked="modelValue" /><span>{{ label }}</span></label>',
    },
    VChip: { name: 'VChip', template: '<span class="v-chip"><slot /></span>' },
    VCard: { name: 'VCard', template: '<div class="v-card"><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
}))

// Mock @/composables/useBase
vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperState: { value: 'ready', __v_isRef: true },
        socketIsConnected: { value: true, __v_isRef: true },
        hostUrl: { value: new URL('http://localhost:8080'), __v_isRef: true },
        apiUrl: { value: 'http://localhost:8080', __v_isRef: true },
        moonrakerComponents: mockConsoleValues.moonrakerComponents,
    }),
}))

// Mock @/composables/useConsole
vi.mock('@/composables/useConsole', () => ({
    useConsole: () => ({
        consoleDirection: mockConsoleValues.consoleDirection,
        autoscroll: mockConsoleValues.autoscroll,
        hideWaitTemperatures: mockConsoleValues.hideWaitTemperatures,
        hideTlCommands: mockConsoleValues.hideTlCommands,
        customFilters: mockConsoleValues.customFilters,
        rawOutput: mockConsoleValues.rawOutput,
        clearConsole: mockConsoleValues.clearConsole,
        toggleFilter: mockConsoleValues.toggleFilter,
        commandClick: mockConsoleValues.commandClick,
    }),
}))

// Mock @mdi/js
vi.mock('@mdi/js', () => ({
    mdiTrashCan: 'mdiTrashCan',
    mdiCog: 'mdiCog',
}))

// Mock child components
vi.mock('@/components/inputs/ConsoleTextarea.vue', () => ({
    default: {
        name: 'ConsoleTextarea',
        props: ['modelValue'],
        template: '<div class="console-textarea-stub" />',
        methods: {
            setGcode: (_msg: string) => {},
        },
    },
}))

vi.mock('@/components/console/CommandHelpModal.vue', () => ({
    default: {
        name: 'CommandHelpModal',
        template: '<div class="command-help-modal-stub" />',
    },
}))

vi.mock('@/components/console/ConsoleTable.vue', () => ({
    default: {
        name: 'ConsoleTable',
        props: ['isMini', 'events'],
        template: '<div class="console-table-stub" />',
    },
}))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: {
        name: 'OverlayScrollbarsComponent',
        template: '<div class="overlayscrollbars"><slot /></div>',
        methods: {
            osInstance: () => ({
                scroll: vi.fn(),
            }),
        },
    },
}))

// Import after mocks
import ConsolePage from '@/pages/Console.vue'

function mountConsole(consoleDirectionValue: string = 'shell', overrides: { moonrakerComponents?: string[] } = {}) {
    mockConsoleValues.consoleDirection._value = consoleDirectionValue
    mockConsoleValues.autoscroll._value = true
    mockConsoleValues.hideWaitTemperatures._value = false
    mockConsoleValues.hideTlCommands._value = false
    mockConsoleValues.customFilters._value = {}
    mockConsoleValues.moonrakerComponents._value = overrides.moonrakerComponents ?? []
    mockConsoleValues.gcodeSetGcode.mockClear()
    mockConsoleValues.clearConsole.mockClear()

    const store = createStore({
        state: {
            server: {},
        },
        getters: {
            'server/getConsoleEvents': () => (isTable: boolean) => [],
        },
    })

    return mount(ConsolePage, {
        global: {
            plugins: [store],
            mocks: {
                $t: (key: string) => key,
            },
        },
    })
}

describe('Console.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mountConsole()
        expect(wrapper.exists()).toBe(true)
    })

    it('renders ConsoleTextarea', () => {
        const wrapper = mountConsole()
        expect(wrapper.findComponent({ name: 'ConsoleTextarea' }).exists()).toBe(true)
    })

    it('renders CommandHelpModal', () => {
        const wrapper = mountConsole()
        expect(wrapper.findComponent({ name: 'CommandHelpModal' }).exists()).toBe(true)
    })

    it('renders ConsoleTable with correct props', () => {
        const wrapper = mountConsole()
        const table = wrapper.findComponent({ name: 'ConsoleTable' })
        expect(table.exists()).toBe(true)
        expect(table.props('isMini')).toBe(false)
    })

    it('has clear button with trash icon', () => {
        const wrapper = mountConsole()
        const trashIcon = wrapper.find('.v-icon')
        expect(trashIcon.exists()).toBe(true)
        expect(trashIcon.text()).toBe('mdiTrashCan')
    })

    it('has settings menu button', () => {
        const wrapper = mountConsole()
        const buttons = wrapper.findAll('.v-btn')
        const settingsBtn = buttons.find((btn) => btn.text().includes('mdiCog'))
        expect(settingsBtn).toBeDefined()
    })

    it('settings menu shows autoscroll checkbox when consoleDirection is shell', () => {
        const wrapper = mountConsole('shell')
        const checkboxes = wrapper.findAll('.v-checkbox')
        const autoscrollCheckbox = checkboxes.find((cb) => cb.text().includes('Panels.MiniconsolePanel.Autoscroll'))
        expect(autoscrollCheckbox).toBeDefined()
    })

    it('settings menu does NOT show autoscroll checkbox when consoleDirection is table', () => {
        const wrapper = mountConsole('table')
        const autoscrollCheckbox = wrapper
            .findAll('.v-checkbox')
            .find((cb) => cb.text().includes('Panels.MiniconsolePanel.Autoscroll'))
        expect(autoscrollCheckbox).toBeUndefined()
    })

    it('settings menu shows hide temperatures checkbox', () => {
        const wrapper = mountConsole()
        const checkbox = wrapper.findAll('.v-checkbox').find((cb) => cb.text().includes('Console.HideTemperatures'))
        expect(checkbox).toBeDefined()
    })

    it('settings menu shows hide timelapse checkbox when timelapse component is present', () => {
        const wrapper = mountConsole('shell', { moonrakerComponents: ['timelapse'] })
        const checkbox = wrapper.findAll('.v-checkbox').find((cb) => cb.text().includes('Console.HideTimelapse'))
        expect(checkbox).toBeDefined()
    })

    it('settings menu does NOT show hide timelapse checkbox when timelapse component is absent', () => {
        mockConsoleValues.moonrakerComponents._value = []
        const wrapper = mountConsole()
        const checkbox = wrapper.findAll('.v-checkbox').find((cb) => cb.text().includes('Console.HideTimelapse'))
        expect(checkbox).toBeUndefined()
    })

    it('settings menu shows raw output checkbox', () => {
        const wrapper = mountConsole()
        const checkbox = wrapper
            .findAll('.v-checkbox')
            .find((cb) => cb.text().includes('Panels.MiniconsolePanel.RawOutput'))
        expect(checkbox).toBeDefined()
    })

    it('clear button calls clearConsole function', () => {
        const wrapper = mountConsole()
        const clearBtn = wrapper.findAll('.v-btn').at(0)
        if (clearBtn) {
            clearBtn.trigger('click')
        }
        expect(mockConsoleValues.clearConsole).toHaveBeenCalled()
    })

    it('renders OverlayScrollbarsComponent', () => {
        const wrapper = mountConsole()
        expect(wrapper.find('.overlayscrollbars').exists()).toBe(true)
    })

    it('renders ConsoleTable inside the scroll container', () => {
        const wrapper = mountConsole()
        const scrollContainer = wrapper.find('.overlayscrollbars')
        const table = scrollContainer.findComponent({ name: 'ConsoleTable' })
        expect(table.exists()).toBe(true)
    })
})
