import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import HistoryListPanelPerformMaintenance from '@/components/dialogs/HistoryListPanelPerformMaintenance.vue'

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: vi.fn(),
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'History.Performed': 'Performed',
                'History.PerformedAndReschedule': 'Performed and Reschedule',
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
    VTextarea: {
        name: 'VTextarea',
        props: ['modelValue', 'label', 'hideDetails', 'variant'],
        template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
    },
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

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: false, initializationList: [], loadings: [] },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                history: {
                    job_totals: {},
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
        note: '',
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
    }
}

describe('HistoryListPanelPerformMaintenance.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders when modelValue is true', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        expect(wrapper.find('.history-perform-maintenance-dialog').exists()).toBe(true)
    })

    it('does not render when modelValue is false', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        expect(wrapper.find('.history-perform-maintenance-dialog').exists()).toBe(false)
    })

    it('shows perform button when item has reminder and no end_time', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        expect(wrapper.text()).toContain('Performed')
    })

    it('hides perform button when item has end_time', () => {
        const store = createStoreWithState()
        const item = createMockItem({ end_time: 1005000 })
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        expect(wrapper.text()).not.toContain('Performed')
    })

    it('hides perform button when item has no reminder', () => {
        const store = createStoreWithState()
        const item = createMockItem({
            reminder: { type: null, filament: { bool: false, value: null }, printtime: { bool: false, value: null }, date: { bool: false, value: null } },
        })
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        expect(wrapper.text()).not.toContain('Performed')
    })

    it('shows "Performed and Reschedule" text for repeat reminders', () => {
        const store = createStoreWithState()
        const item = createMockItem({
            reminder: { type: 'repeat', filament: { bool: true, value: 1000 }, printtime: { bool: false, value: null }, date: { bool: false, value: null } },
        })
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        expect(wrapper.text()).toContain('Performed and Reschedule')
    })

    it('dispatches gui/maintenance/perform on perform', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        const performBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Performed'))
        if (performBtn) {
            await performBtn.trigger('click')
        }

        expect(store.dispatch).toHaveBeenCalledWith('gui/maintenance/perform', {
            id: 'entry_1',
            note: '',
        })
    })

    it('emits close-details-dialog on perform', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        const performBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Performed'))
        if (performBtn) {
            await performBtn.trigger('click')
        }

        expect(wrapper.emitted('close-details-dialog')).toBeTruthy()
    })

    it('closes dialog on cancel', async () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        const cancelBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Buttons.Cancel'))
        if (cancelBtn) {
            await cancelBtn.trigger('click')
        }

        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        if (wrapper.emitted('update:modelValue')) {
            expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
        }
    })

    it('resets note when dialog opens', async () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelPerformMaintenance, {
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

        // Open dialog - note should reset to empty
        await wrapper.setProps({ modelValue: true })

        const textarea = wrapper.find('textarea')
        expect(textarea.element.value).toBe('')
    })
})
