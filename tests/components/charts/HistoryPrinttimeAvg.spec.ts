import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted: mutable data holder — use class-based mock refs
const mockRefFactory = vi.hoisted(() => {
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
    return MockRef
})

const mockAllJobs = vi.hoisted(() => new mockRefFactory([]))
const mockSelectedJobs = vi.hoisted(() => new mockRefFactory([]))

function createMockJob(overrides: Record<string, any>): any {
    const now = Date.now() / 1000
    return {
        job_id: '1',
        status: 'completed',
        start_time: now - 10000,
        print_duration: 3600,
        total_duration: 3600,
        filename: 'test.gcode',
        exists: true,
        end_time: now,
        filament_used: 100,
        metadata: {},
        ...overrides,
    }
}

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        hours12Format: { value: false },
        formatTime: (ts: number) => {
            const d = new Date(ts)
            return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
        },
    }),
}))

vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({
        fgColorHi: { value: 'rgba(255, 255, 255, 0.8)' },
        fgColorMid: { value: 'rgba(255, 255, 255, 0.5)' },
        fgColorLow: { value: 'rgba(255, 255, 255, 0.2)' },
        fgColorFaint: { value: 'rgba(255, 255, 255, 0.1)' },
        bgColor: () => 'rgba(0, 0, 0, 1)',
    }),
}))

vi.mock('@/composables/useHistory', () => ({
    useHistory: () => ({
        allJobs: mockAllJobs,
        selectedJobs: mockSelectedJobs,
        jobs: mockAllJobs,
        hidePrintStatus: { value: [] },
        moonrakerHistoryFields: { value: [] },
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('vuetify', () => ({
    useTheme: () => ({
        global: {
            current: {
                value: {
                    dark: true,
                },
            },
        },
    }),
}))

// Mock vue-echarts (e-chart)
vi.mock('vue-echarts', () => ({
    default: {
        name: 'EChart',
        props: ['option', 'initOptions', 'autoresize', 'style'],
        template: '<div class="e-chart" :style="style"><slot /></div>',
    },
}))

// Mock v-observe-visibility directive
vi.mock('vue-observe-visibility', () => ({
    default: {
        mounted: vi.fn(),
        unmounted: vi.fn(),
    },
}))

import { mount } from '@vue/test-utils'
import HistoryPrinttimeAvg from '@/components/charts/HistoryPrinttimeAvg.vue'

const EChartStub = {
    name: 'EChart',
    props: ['option', 'initOptions', 'autoresize', 'style'],
    template: '<div class="e-chart" :style="style"><slot /></div>',
}

function createWrapper() {
    return mount(HistoryPrinttimeAvg, {
        global: {
            components: {
                'e-chart': EChartStub,
            },
        },
    })
}

describe('HistoryPrinttimeAvg.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAllJobs.value = []
        mockSelectedJobs.value = []
    })

    it('renders the e-chart component', () => {
        const wrapper = createWrapper()
        expect(wrapper.find('.e-chart').exists()).toBe(true)
    })

    it('applies fixed height and width styles', () => {
        const wrapper = createWrapper()
        const chart = wrapper.find('.e-chart')
        expect(chart.attributes('style')).toContain('height: 175px')
        expect(chart.attributes('style')).toContain('width: 100%')
    })

    it('passes init-options with svg renderer', () => {
        const wrapper = createWrapper()
        const chart = wrapper.findComponent({ name: 'EChart' })
        expect(chart.props('initOptions')).toEqual({ renderer: 'svg' })
    })

    it('renders with zero array data when no jobs', () => {
        mockAllJobs.value = []
        const wrapper = createWrapper()
        const chart = wrapper.findComponent({ name: 'EChart' })
        expect(chart.props('option')).toBeTruthy()
    })

    it('computes [1,0,0,0,0] for a single 30-min job (0-2h bucket)', () => {
        const now = Date.now() / 1000
        mockAllJobs.value = [
            createMockJob({
                job_id: '1',
                print_duration: 1800,
                start_time: now - 5000,
            }),
        ]
        const wrapper = createWrapper()
        const chart = wrapper.findComponent({ name: 'EChart' })
        const option = chart.props('option') as any
        expect(option).toBeTruthy()
        expect(option.series[0].data).toEqual([1, 0, 0, 0, 0])
    })

    it('computes correct buckets with one job per range', () => {
        const now = Date.now() / 1000
        mockAllJobs.value = [
            createMockJob({ job_id: '1', print_duration: 3600, start_time: now - 10000 }),
            createMockJob({ job_id: '2', print_duration: 14400, start_time: now - 20000 }),
            createMockJob({ job_id: '3', print_duration: 32400, start_time: now - 30000 }),
            createMockJob({ job_id: '4', print_duration: 64800, start_time: now - 40000 }),
            createMockJob({ job_id: '5', print_duration: 90000, start_time: now - 50000 }),
        ]
        const wrapper = createWrapper()
        const chart = wrapper.findComponent({ name: 'EChart' })
        const option = chart.props('option') as any
        expect(option).toBeTruthy()
        expect(option.series[0].data).toEqual([1, 1, 1, 1, 1])
    })

    it('ignores jobs older than 14 days', () => {
        const now = Date.now() / 1000
        const fourteenDaysSecs = 60 * 60 * 24 * 14
        mockAllJobs.value = [
            createMockJob({
                job_id: 'old',
                print_duration: 3600,
                start_time: now - fourteenDaysSecs - 100,
            }),
        ]
        const wrapper = createWrapper()
        const chart = wrapper.findComponent({ name: 'EChart' })
        const option = chart.props('option') as any
        expect(option).toBeTruthy()
        expect(option.series[0].data).toEqual([0, 0, 0, 0, 0])
    })

    it('ignores non-completed jobs', () => {
        const now = Date.now() / 1000
        mockAllJobs.value = [
            createMockJob({
                job_id: 'cancelled',
                status: 'cancelled',
                print_duration: 3600,
                start_time: now - 5000,
            }),
        ]
        const wrapper = createWrapper()
        const chart = wrapper.findComponent({ name: 'EChart' })
        const option = chart.props('option') as any
        expect(option).toBeTruthy()
        expect(option.series[0].data).toEqual([0, 0, 0, 0, 0])
    })

    it('uses selectedJobs when available', () => {
        const now = Date.now() / 1000
        mockAllJobs.value = [
            createMockJob({ job_id: '1', print_duration: 3600, start_time: now - 10000 }),
            createMockJob({ job_id: '2', print_duration: 14400, start_time: now - 20000 }),
        ]
        mockSelectedJobs.value = [createMockJob({ job_id: 's1', print_duration: 7200, start_time: now - 15000 })]
        const wrapper = createWrapper()
        const chart = wrapper.findComponent({ name: 'EChart' })
        const option = chart.props('option') as any
        expect(option).toBeTruthy()
        expect(option.series[0].data).toEqual([1, 0, 0, 0, 0])
    })

    it('renders with default xAxis categories (0-2h, 2-6h, etc.)', () => {
        mockAllJobs.value = []
        const wrapper = createWrapper()
        const chart = wrapper.findComponent({ name: 'EChart' })
        const option = chart.props('option') as any
        expect(option.xAxis.data).toContain('0-2h')
        expect(option.xAxis.data).toContain('2-6h')
        expect(option.xAxis.data).toContain('6-12h')
        expect(option.xAxis.data).toContain('12-24h')
        expect(option.xAxis.data).toContain('>24h')
    })
})
