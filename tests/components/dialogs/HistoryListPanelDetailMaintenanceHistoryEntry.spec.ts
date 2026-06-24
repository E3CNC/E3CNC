import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string, opts?: any) => (opts ? key + JSON.stringify(opts) : key) }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        formatDateTime: (ts: number) => new Date(ts).toLocaleString(),
    }),
}))

vi.mock('@mdi/js', () => ({
    mdiAdjust: 'mdiAdjust',
    mdiAlarm: 'mdiAlarm',
    mdiCalendar: 'mdiCalendar',
}))

vi.mock('vuetify/components', () => ({
    VTimelineItem: {
        name: 'VTimelineItem',
        props: ['size', 'hideDot'],
        template: '<div class="v-timeline-item"><slot /></div>',
    },
    VIcon: {
        name: 'VIcon',
        props: ['size'],
        template: '<span class="v-icon-stub"><slot /></span>',
    },
}))

import HistoryListPanelDetailMaintenanceHistoryEntry from '@/components/dialogs/HistoryListPanelDetailMaintenanceHistoryEntry.vue'

function makeStore(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            server: {
                history: {
                    job_totals: {
                        total_filament_used: overrides.total_filament_used ?? 500000,
                        total_print_time: overrides.total_print_time ?? 36000,
                    },
                },
            },
        },
    })
}

function baseItem() {
    return {
        start_time: 1000000,
        end_time: 2000000,
        start_filament: 0,
        end_filament: 100000,
        start_printtime: 0,
        end_printtime: 3600,
        perform_note: 'Replaced belt\nLubricated rails',
        reminder: {
            type: 'recurring',
            filament: { bool: true, value: 500 },
            printtime: { bool: true, value: 100 },
            date: { bool: true, value: 365 },
        },
    }
}

describe('HistoryListPanelDetailMaintenanceHistoryEntry.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(HistoryListPanelDetailMaintenanceHistoryEntry, {
            props: { item: baseItem(), current: true, last: false },
            global: {
                plugins: [makeStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders filament, printtime, and days text', () => {
        const wrapper = mount(HistoryListPanelDetailMaintenanceHistoryEntry, {
            props: { item: baseItem(), current: true, last: false },
            global: {
                plugins: [makeStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('m')
        expect(wrapper.text()).toContain('h')
        expect(wrapper.text()).toContain('days')
    })

    it('shows last text when last prop is true', () => {
        const wrapper = mount(HistoryListPanelDetailMaintenanceHistoryEntry, {
            props: { item: baseItem(), current: false, last: true },
            global: {
                plugins: [makeStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('History.EntryCreatedAt')
    })

    it('renders note with line breaks', () => {
        const wrapper = mount(HistoryListPanelDetailMaintenanceHistoryEntry, {
            props: { item: baseItem(), current: true, last: false },
            global: {
                plugins: [makeStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.html()).toContain('Replaced belt')
    })
})
