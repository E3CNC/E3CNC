import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HistoryAllPrintStatusTableItem from '@/components/charts/HistoryAllPrintStatusTableItem.vue'

vi.mock('@/plugins/helpers', () => ({
    formatPrintTime: (seconds: number) => {
        if (!seconds) return '--'
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = Math.round(seconds % 60)
        const parts: string[] = []
        if (h) parts.push(`${h}h`)
        if (m) parts.push(`${m}m`)
        if (s) parts.push(`${s}s`)
        return parts.join(' ') || '--'
    },
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

const baseItem = {
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
}

describe('HistoryAllPrintStatusTableItem.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders displayName in first cell', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: baseItem,
                valueName: 'jobs',
            },
        })
        const cells = wrapper.findAll('td')
        expect(cells[0].text()).toBe('Completed')
    })

    it('renders count value when valueName is jobs', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: { ...baseItem, value: 5 },
                valueName: 'jobs',
            },
        })
        const cells = wrapper.findAll('td')
        expect(cells[1].text()).toBe('5')
    })

    it('renders filament value in mm when <= 1000', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: { ...baseItem, value: 500 },
                valueName: 'filament',
            },
        })
        const cells = wrapper.findAll('td')
        expect(cells[1].text()).toBe('500 mm')
    })

    it('renders filament value in m when > 1000 (Math.round)', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: { ...baseItem, value: 1500 },
                valueName: 'filament',
            },
        })
        const cells = wrapper.findAll('td')
        // Math.round(1500/1000) = Math.round(1.5) = 2 → '2.00 m'
        expect(cells[1].text()).toBe('2.00 m')
    })

    it('renders time value via formatPrintTime', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: { ...baseItem, value: 3661 },
                valueName: 'time',
            },
        })
        const cells = wrapper.findAll('td')
        // 3661 seconds = 1h 1m 1s
        expect(cells[1].text()).toBe('1h 1m 1s')
    })

    it('renders time value as -- for zero seconds', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: { ...baseItem, value: 0 },
                valueName: 'time',
            },
        })
        const cells = wrapper.findAll('td')
        expect(cells[1].text()).toBe('--')
    })

    it('renders with valueName defaulting to jobs treatment when undefined', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: { ...baseItem, value: 42 },
            },
        })
        const cells = wrapper.findAll('td')
        // No valueName defaults to toString() which is '42'
        expect(cells[1].text()).toBe('42')
    })

    it('has text-right class on value cell', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: baseItem,
                valueName: 'jobs',
            },
        })
        const cells = wrapper.findAll('td')
        expect(cells[1].classes()).toContain('text-right')
    })

    it('renders filament value of exactly 1000 as 1000 mm', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: { ...baseItem, value: 1000 },
                valueName: 'filament',
            },
        })
        const cells = wrapper.findAll('td')
        expect(cells[1].text()).toBe('1000 mm')
    })

    it('renders filament value of 0 as 0 mm', () => {
        const wrapper = mount(HistoryAllPrintStatusTableItem, {
            props: {
                item: { ...baseItem, value: 0 },
                valueName: 'filament',
            },
        })
        const cells = wrapper.findAll('td')
        expect(cells[1].text()).toBe('0 mm')
    })
})
