import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import Console from '@/pages/Console.vue'

const mockEmit = vi.fn()

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: { value: true },
        printerIsPrinting: { value: false },
        printerIsPrintingOnly: { value: false },
    }),
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mockEmit }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], cardClass: String },
        template: '<div :class="cardClass"><slot name="buttons" /><slot /></div>',
    },
}))

vi.mock('@/components/inputs/ConsoleTextarea.vue', () => ({
    default: {
        name: 'ConsoleTextarea',
        template: '<textarea class="console-textarea" placeholder="G-Code"></textarea>',
    },
}))

vi.mock('vuetify/components', () => ({
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'disabled'],
        template: '<button class="v-btn" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', template: '<i class="v-icon"><slot /></i>' },
    VMenu: {
        name: 'VMenu',
        template: '<div class="v-menu"><slot name="activator" /><slot /></div>',
    },
    VList: { name: 'VList', template: '<div class="v-list"><slot /></div>' },
    VListItem: {
        name: 'VListItem',
        props: ['value'],
        template: '<div class="v-list-item"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VTooltip: {
        name: 'VTooltip',
        template: '<div class="v-tooltip"><slot name="activator" /><slot /></div>',
    },
}))

function makeStore(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [] },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                console: { events: [{ message: 'FIRMWARE_RESTART', date: Date.now() }] },
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
                console: {
                    hideWaitTemperatures: false,
                    hideTlCommands: false,
                    autoscroll: true,
                    filters: [],
                },
            },
            files: {},
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'gui/getPanelExpand': () => () => true,
            'server/getConsoleEvents': () => (hideFilter: boolean) => {
                if (hideFilter) return [{ message: 'filtered', date: Date.now() }]
                return [{ message: 'FIRMWARE_RESTART', date: Date.now() }]
            },
            'gui/console/getConsolefilterRules': () => [],
            'gui/console/getConsoleClearedSince': () => 0,
            ...(overrides.getters || {}),
        },
    })
}

describe('Console.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('mounts without crashing', () => {
        const wrapper = mount(Console, { global: { plugins: [makeStore()] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders console panel', () => {
        const wrapper = mount(Console, { global: { plugins: [makeStore()] } })
        expect(wrapper.find('.console-page').exists()).toBe(true)
    })

    it('renders console events', () => {
        const wrapper = mount(Console, { global: { plugins: [makeStore()] } })
        expect(wrapper.text()).toContain('FIRMWARE_RESTART')
    })
})
