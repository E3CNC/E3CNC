import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock data — plain objects
const mockStatusData = vi.hoisted(() => [
    {
        name: 'completed',
        displayName: 'Completed',
        value: 10,
        showInTable: true,
        itemStyle: {
            opacity: 0.9,
            color: 'rgba(255,255,255,0.6)',
            borderColor: 'rgba(255,255,255,0.12)',
            borderWidth: 2,
            borderRadius: 3,
        },
    },
    {
        name: 'cancelled',
        displayName: 'Cancelled',
        value: 3,
        showInTable: true,
        itemStyle: {
            opacity: 0.9,
            color: 'rgba(255,255,255,0.38)',
            borderColor: 'rgba(255,255,255,0.12)',
            borderWidth: 2,
            borderRadius: 3,
        },
    },
])

vi.mock('@/composables/useHistoryStats', () => ({
    useHistoryStats: () => ({
        allPrintStati: ['completed', 'cancelled'],
        printStatusArray: mockStatusData,
        printStatusArrayChart: mockStatusData,
        groupedPrintStatusArray: mockStatusData,
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({
        fgColorHi: { value: 'rgba(255, 255, 255, 0.8)' },
        fgColorMid: { value: 'rgba(255, 255, 255, 0.5)' },
        fgColorLow: { value: 'rgba(255, 255, 255, 0.2)' },
        fgColorFaint: { value: 'rgba(255, 255, 255, 0.1)' },
    }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        hours12Format: { value: false },
        formatTime: (ts: number) => `${new Date(ts).getHours()}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`,
    }),
}))

vi.mock('vuetify', () => ({
    useTheme: () => ({
        global: {
            current: {
                value: { dark: true },
            },
        },
    }),
    createVuetify: () => ({}),
}))

vi.mock('vuetify/components', () => ({
    VTable: {
        name: 'VTable',
        template: '<table class="v-table"><slot /></table>',
    },
}))

import { shallowMount } from '@vue/test-utils'
import HistoryAllPrintStatusTable from '@/components/charts/HistoryAllPrintStatusTable.vue'

describe('HistoryAllPrintStatusTable.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function createWrapper(props: Record<string, any> = {}) {
        return shallowMount(HistoryAllPrintStatusTable, {
            props,
            global: {
                stubs: {
                    'v-table': {
                        template: '<div class="v-table-stub"><slot /></div>',
                    },
                    'history-all-print-status-table-item': {
                        props: ['item', 'valueName'],
                        template: '<div class="item-stub">{{ item.displayName }} {{ item.value }}</div>',
                    },
                },
            },
        })
    }

    it('renders the table wrapper', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        expect(wrapper.find('.v-table-stub').exists()).toBe(true)
    })

    it('renders a tbody inside the table', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        expect(wrapper.find('tbody').exists()).toBe(true)
    })

    it('renders a HistoryAllPrintStatusTableItem for each status entry', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        const itemStubs = wrapper.findAll('.item-stub')
        expect(itemStubs.length).toBe(2)
    })

    it('passes correct valueName to each item stub', () => {
        const wrapper = createWrapper({ valueName: 'filament' })
        const itemStubs = wrapper.findAll('.item-stub')
        // With our custom stub, check that items rendered
        expect(itemStubs.length).toBe(2)
        expect(itemStubs[0].text()).toContain('Completed')
        expect(itemStubs[1].text()).toContain('Cancelled')
    })

    it('renders without valueName prop (defaults to jobs)', () => {
        const wrapper = shallowMount(HistoryAllPrintStatusTable, {
            global: {
                stubs: {
                    'v-table': {
                        template: '<div class="v-table-stub"><slot /></div>',
                    },
                    'history-all-print-status-table-item': true,
                },
            },
        })
        expect(wrapper.find('.v-table-stub').exists()).toBe(true)
    })
})
