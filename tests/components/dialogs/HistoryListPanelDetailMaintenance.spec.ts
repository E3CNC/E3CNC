import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import type { GuiMaintenanceStateEntry } from '@/store/gui/maintenance/types'
import HistoryListPanelDetailMaintenance from '@/components/dialogs/HistoryListPanelDetailMaintenance.vue'

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
        apiUrl: new MockRef('//localhost:8080'),
        klipperReadyForGui: new MockRef(true),
        printerIsPrinting: new MockRef(false),
        formatDateTime: (ts: number) => new Date(ts).toISOString(),
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
        t: (key: string) => {
            const translations: Record<string, string> = {
                'History.EntrySince': 'Since',
                'History.EntryNextPerform': 'Next perform',
                'History.EntryPerformedAt': 'Performed at {date}',
                'History.Maintenance': 'Maintenance',
                'History.Perform': 'Perform',
            }
            return translations[key] ?? key
        },
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VDialog: {
        name: 'VDialog',
        props: ['modelValue'],
        template: '<div><slot v-if="modelValue" /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VTimeline: { name: 'VTimeline', props: ['alignTop', 'density'], template: '<div><slot /></div>' },
    VTimelineItem: { name: 'VTimelineItem', props: ['size', 'hideDot'], template: '<div><slot /></div>' },
    VBtn: { name: 'VBtn', props: ['icon', 'rounded', 'color', 'variant'], template: '<button><slot /></button>' },
    VIcon: { name: 'VIcon', props: ['icon'], template: '<i><slot /></i>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['icon', 'title', 'cardClass', 'marginBottom'],
        template: '<div :class="cardClass"><slot name="buttons" /><slot /></div>',
    },
}))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: {
        name: 'OverlayScrollbarsComponent',
        template: '<div><slot /></div>',
    },
}))

vi.mock('@/components/dialogs/HistoryListPanelDetailMaintenanceHistoryEntry.vue', () => ({
    default: {
        name: 'HistoryListPanelDetailMaintenanceHistoryEntry',
        props: ['item', 'current', 'last'],
        template: '<div class="history-entry-child" />',
    },
}))

vi.mock('@/components/dialogs/HistoryListPanelPerformMaintenance.vue', () => ({
    default: {
        name: 'HistoryListPanelPerformMaintenance',
        props: ['modelValue', 'item'],
        template: '<div class="perform-dialog" />',
    },
}))

vi.mock('@/components/dialogs/HistoryListPanelEditMaintenance.vue', () => ({
    default: {
        name: 'HistoryListPanelEditMaintenance',
        props: ['modelValue', 'item'],
        template: '<div class="edit-dialog" />',
    },
}))

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: false, initializationList: [], loadings: [] },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                history: {
                    job_totals: {
                        total_filament_used: 50000,
                        total_print_time: 7200,
                    },
                },
                ...(overrides.server || {}),
            },
            printer: {
                print_stats: { state: 'ready' },
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
                ...(overrides.gui || {}),
            },
            files: {},
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'gui/getPanelExpand': () => () => true,
            'gui/maintenance/getEntries': () => [],
            ...(overrides.getters || {}),
        },
    })
}

function createMockItem(overrides: Record<string, any> = {}) {
    return {
        id: 'entry_1',
        name: 'Oil Change',
        note: 'Engine oil',
        perform_note: null,
        start_time: 1000000,
        end_time: null,
        start_filament: 0,
        end_filament: null,
        start_printtime: 0,
        end_printtime: null,
        last_entry: null,
        reminder: {
            type: 'one-time',
            filament: { bool: true, value: 1000 },
            printtime: { bool: false, value: null },
            date: { bool: false, value: null },
        },
        ...overrides,
    } as GuiMaintenanceStateEntry
}

describe('HistoryListPanelDetailMaintenance.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders when modelValue is true', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelDetailMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('.history-maintenance-dialog').exists()).toBe(true)
    })

    it('does not render when modelValue is false', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelDetailMaintenance, {
            props: {
                modelValue: false,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('.history-maintenance-dialog').exists()).toBe(false)
    })

    it('displays item name', () => {
        const store = createStoreWithState()
        const item = createMockItem({ name: 'Oil Change' })
        const wrapper = mount(HistoryListPanelDetailMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('Oil Change')
    })

    it('displays note when present', () => {
        const store = createStoreWithState()
        const item = createMockItem({ note: 'Engine oil changed' })
        const wrapper = mount(HistoryListPanelDetailMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('Engine oil changed')
    })

    it('shows perform button when item has reminder and no end_time', () => {
        const store = createStoreWithState()
        const item = createMockItem({
            reminder: {
                type: 'one-time',
                filament: { bool: true, value: 1000 },
                printtime: { bool: false, value: null },
                date: { bool: false, value: null },
            },
            end_time: null,
        })
        const wrapper = mount(HistoryListPanelDetailMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.Perform')
    })

    it('hides perform button when item has end_time', () => {
        const store = createStoreWithState()
        const item = createMockItem({
            end_time: 1005000,
            reminder: {
                type: 'one-time',
                filament: { bool: true, value: 1000 },
                printtime: { bool: false, value: null },
                date: { bool: false, value: null },
            },
        })
        const wrapper = mount(HistoryListPanelDetailMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).not.toContain('History.Perform')
    })

    it('hides perform button when item has no reminder', () => {
        const store = createStoreWithState()
        const item = createMockItem({
            reminder: {
                type: null,
                filament: { bool: false, value: null },
                printtime: { bool: false, value: null },
                date: { bool: false, value: null },
            },
            end_time: null,
        })
        const wrapper = mount(HistoryListPanelDetailMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).not.toContain('History.Perform')
    })

    it('emits close on edit button', async () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelDetailMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        const allButtons = wrapper.findAll('button')
        // Find the Cancel button by its text label
        const cancelBtn = allButtons.find((btn) => btn.text().includes('Buttons.Cancel'))
        expect(cancelBtn).toBeTruthy()
        await cancelBtn!.trigger('click')

        const emitted = wrapper.emitted('update:modelValue')
        expect(emitted).toBeTruthy()
        if (emitted) {
            expect(emitted[0]).toEqual([false])
        }
    })

    it('traverses history via last_entry chain', () => {
        const entries = {
            entry_1: {
                id: 'entry_1',
                name: 'Oil Change 3',
                note: '',
                start_time: 1000000,
                end_time: 1005000,
                reminder: {
                    type: null,
                    filament: { bool: false, value: null },
                    printtime: { bool: false, value: null },
                    date: { bool: false, value: null },
                },
                last_entry: 'entry_2',
            },
            entry_2: {
                id: 'entry_2',
                name: 'Oil Change 2',
                note: '',
                start_time: 900000,
                end_time: 905000,
                reminder: {
                    type: null,
                    filament: { bool: false, value: null },
                    printtime: { bool: false, value: null },
                    date: { bool: false, value: null },
                },
                last_entry: 'entry_3',
            },
            entry_3: {
                id: 'entry_3',
                name: 'Oil Change 1',
                note: '',
                start_time: 800000,
                end_time: 805000,
                reminder: {
                    type: null,
                    filament: { bool: false, value: null },
                    printtime: { bool: false, value: null },
                    date: { bool: false, value: null },
                },
                last_entry: null,
            },
        }

        const store = createStoreWithState({
            getters: {
                'socket/getUrl': () => '//localhost:8080',
                'gui/getPanelExpand': () => () => true,
                'gui/maintenance/getEntries': () => Object.values(entries),
            },
        })

        const item: any = {
            ...entries.entry_1,
            start_filament: 0,
            end_filament: null,
            start_printtime: 0,
            end_printtime: null,
            perform_note: null,
        }

        const wrapper = mount(HistoryListPanelDetailMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // Should render history entry children for each entry in the chain
        const children = wrapper.findAll('.history-entry-child')
        expect(children.length).toBe(3)
    })
})
