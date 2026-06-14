import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useHistoryStats } from '@/composables/useHistoryStats'

const historyState = vi.hoisted(() => ({
    allJobs: { value: [] as any[] },
    jobs: { value: [] as any[] },
    selectedJobs: { value: [] as any[] },
    hidePrintStatus: { value: [] as string[] },
}))

vi.mock('@/composables/useHistory', () => ({
    useHistory: () => historyState,
}))

vi.mock('@/plugins/i18n', () => ({
    default: {
        global: {
            te: (key: string) => key !== 'History.StatusValues.unknown',
            t: (key: string) => `t:${key}`,
        },
    },
}))

describe('useHistoryStats', () => {
    beforeEach(() => {
        historyState.allJobs.value = []
        historyState.jobs.value = []
        historyState.selectedJobs.value = []
        historyState.hidePrintStatus.value = []
    })

    function mountComposable(valueName: 'filament' | 'time' | 'status') {
        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useHistoryStats(valueName as any)
                return () => h('div')
            },
        })

        mount(TestComponent)
        return result
    }

    it('groups statuses and localizes known values', () => {
        historyState.allJobs.value = [
            { status: 'completed', filament_used: 2, total_duration: 10 },
            { status: 'completed', filament_used: 1, total_duration: 5 },
            { status: 'failed', filament_used: 3, total_duration: 20 },
            { status: 'unknown', filament_used: 1, total_duration: 1 },
        ]

        const stats = mountComposable('status')
        expect(stats.allPrintStati.value).toEqual(['completed', 'failed', 'unknown'])
        expect(stats.printStatusArray.value[0].displayName).toBe('t:History.StatusValues.completed')
        expect(stats.printStatusArray.value[1].showInTable).toBe(true)
        expect(stats.printStatusArray.value[2].displayName).toBe('unknown')
    })

    it('builds chart data for filament and time and groups small entries', () => {
        historyState.allJobs.value = [
            { status: 'completed', filament_used: 10, total_duration: 100 },
            { status: 'completed', filament_used: 5, total_duration: 50 },
            { status: 'failed', filament_used: 1, total_duration: 5 },
            { status: 'cancelled', filament_used: 1, total_duration: 2 },
        ]
        historyState.jobs.value = historyState.allJobs.value

        const filament = mountComposable('filament')
        expect(filament.printStatusArrayChart.value.some((e: any) => e.name === 'completed' && e.value === 15)).toBe(true)
        expect(filament.groupedPrintStatusArray.value.length).toBeGreaterThan(0)

        const time = mountComposable('time')
        expect(time.printStatusArrayChart.value.some((e: any) => e.name === 'completed' && e.value === 150)).toBe(true)
    })
})
