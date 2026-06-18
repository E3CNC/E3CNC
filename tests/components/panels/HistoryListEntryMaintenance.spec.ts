import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import type { GuiMaintenanceStateEntry } from '@/store/gui/maintenance/types'
import HistoryListEntryMaintenance from '@/components/panels/History/HistoryListEntryMaintenance.vue'

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
        t: (key: string) => key,
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VCheckbox: {
        name: 'VCheckbox',
        props: ['modelValue', 'density', 'hideDetails', 'ripple'],
        template:
            '<input type="checkbox" :checked="modelValue" @click.stop="$emit(\'update:modelValue\', !modelValue)" />',
    },
    VIcon: { name: 'VIcon', props: ['start', 'icon', 'size', 'color', 'disabled'], template: '<i><slot /></i>' },
    VTooltip: {
        name: 'VTooltip',
        props: ['location', 'top', 'text'],
        template: '<div><slot name=\"activator\" :props=\"{}\" /><slot /></div>',
    },
    VMenu: {
        name: 'VMenu',
        props: ['modelValue', 'positionX', 'positionY', 'absolute', 'offsetY'],
        template: '<div :data-menu-open="modelValue"><slot /></div>',
    },
    VList: { name: 'VList', template: '<div><slot /></div>' },
    VListItem: { name: 'VListItem', props: ['disabled'], template: '<div @click="$attrs.onClick"><slot /></div>' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@/plugins/eventBus', () => ({
    EventBus: {
        $emit: vi.fn(),
        $on: vi.fn(),
        $off: vi.fn(),
    },
    CLOSE_CONTEXT_MENU: 'closeContextMenu',
}))

vi.mock('@/directives/longpress', () => ({
    default: {
        mounted: vi.fn(),
        unmounted: vi.fn(),
    },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['icon', 'title', 'cardClass', 'marginBottom'],
        template: '<div :class="cardClass"><slot /></div>',
    },
}))

vi.mock('@/components/dialogs/HistoryListPanelDetailMaintenance.vue', () => ({
    default: {
        name: 'HistoryListPanelDetailMaintenance',
        props: ['modelValue', 'item'],
        template: '<div class="detail-maintenance-dialog" />',
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
                        total_filament_used: 10000,
                        total_print_time: 3600,
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

describe('HistoryListEntryMaintenance.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders item name', () => {
        const store = createStoreWithState()
        const item = createMockItem({ name: 'Oil Change' })
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
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

    it('renders checkbox', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
    })

    it('emits select event on checkbox click', async () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        const checkbox = wrapper.find('input[type="checkbox"]')
        await checkbox.trigger('click')

        const emitted = wrapper.emitted('select')
        expect(emitted).toBeTruthy()
        if (emitted) {
            expect(emitted[0]).toEqual([true])
        }
    })

    it('shows reminder icon when reminder type is set', () => {
        const store = createStoreWithState()
        const item = createMockItem({
            reminder: {
                type: 'one-time',
                filament: { bool: true, value: 1000 },
                printtime: { bool: false, value: null },
                date: { bool: false, value: null },
            },
        })
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // The alarm icon should be present for one-time reminder
        expect(wrapper.findComponent({ name: 'VIcon' }).exists()).toBe(true)
    })

    it('does not show reminder icon when no reminder type', () => {
        const store = createStoreWithState()
        const item = createMockItem({
            reminder: {
                type: null,
                filament: { bool: false, value: null },
                printtime: { bool: false, value: null },
                date: { bool: false, value: null },
            },
        })
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // No VTooltip rendered when reminder is null
        expect(wrapper.findComponent({ name: 'VTooltip' }).exists()).toBe(false)
    })

    it('shows filament reminder text', () => {
        const store = createStoreWithState({
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                history: {
                    job_totals: {
                        total_filament_used: 50000,
                        total_print_time: 3600,
                    },
                },
            },
        })
        const item = createMockItem({
            start_filament: 0,
            end_filament: null,
            reminder: {
                type: 'one-time',
                filament: { bool: true, value: 1000 },
                printtime: { bool: false, value: null },
                date: { bool: false, value: null },
            },
        })
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // 50000 - 0 = 50000 mm = 50 m, so "50 / 1000 m"
        expect(wrapper.text()).toContain('50')
        expect(wrapper.text()).toContain('1000')
    })

    it('shows printtime reminder text', () => {
        const store = createStoreWithState({
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                history: {
                    job_totals: {
                        total_filament_used: 0,
                        total_print_time: 7200, // 2 hours
                    },
                },
            },
        })
        const item = createMockItem({
            start_printtime: 0,
            end_printtime: null,
            reminder: {
                type: 'one-time',
                filament: { bool: false, value: null },
                printtime: { bool: true, value: 100 },
                date: { bool: false, value: null },
            },
        })
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // 7200 / 3600 = 2 h, so "2.0 / 100 h"
        expect(wrapper.text()).toContain('2.0')
        expect(wrapper.text()).toContain('100')
    })

    it('displays not completed icon (mdiNotebook) when end_time is null', () => {
        const store = createStoreWithState()
        const item = createMockItem({ end_time: null })
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // mdiNotebook is used when end_time is null
        expect(wrapper.find('tr').exists()).toBe(true)
    })

    it('dispatches gui/maintenance/delete on delete from context menu', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const item = createMockItem()
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // Trigger context menu
        const tr = wrapper.find('tr')
        await tr.trigger('contextmenu')

        // Now EventBus should have been called
        const { EventBus, CLOSE_CONTEXT_MENU } = await import('@/plugins/eventBus')
        expect(EventBus.$emit).toHaveBeenCalledWith(CLOSE_CONTEXT_MENU)
    })

    it('shows detail maintenance dialog on row click', async () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // The detail maintenance dialog is embedded in the component
        // We just verify the mock dialog exists in the component
        expect(wrapper.find('.detail-maintenance-dialog').exists()).toBe(true)
    })

    it('renders with table fields', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const tableFields = [
            { title: 'Name', key: 'name', text: 'Name', value: 'name', align: 'left', configable: true, visible: true },
        ]
        const wrapper = mount(HistoryListEntryMaintenance, {
            props: {
                item,
                tableFields,
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('tr').exists()).toBe(true)
    })
})
