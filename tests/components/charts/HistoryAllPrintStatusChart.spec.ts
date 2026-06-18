import { describe, it, expect, vi, beforeEach } from 'vitest'

// MockRef class to avoid importing 'vue' in hoisted context
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

// Hoisted mock data — plain objects, not refs
const mockGroupedData = vi.hoisted(() => [
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
        name: 'in_progress',
        displayName: 'In Progress',
        value: 2,
        showInTable: true,
        itemStyle: {
            opacity: 0.9,
            color: 'rgba(255,255,255,0.9)',
            borderColor: 'rgba(255,255,255,0.12)',
            borderWidth: 2,
            borderRadius: 3,
        },
    },
])

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

vi.mock('@/composables/useHistoryStats', () => ({
    useHistoryStats: () => ({
        allPrintStati: new mockRefFactory(['completed', 'in_progress']),
        printStatusArray: new mockRefFactory(mockGroupedData),
        printStatusArrayChart: new mockRefFactory(mockGroupedData),
        groupedPrintStatusArray: new mockRefFactory(mockGroupedData),
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

// Mock vuetify completely to avoid CSS import issues
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
    createVuetify: () => ({}),
}))

// Mock vue-observe-visibility directive
vi.mock('vue-observe-visibility', () => ({
    default: {
        mounted: vi.fn(),
        unmounted: vi.fn(),
    },
}))

vi.mock('@/plugins/helpers', () => ({
    formatPrintTime: (seconds: number) => {
        if (!seconds) return '--'
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        return `${h}h ${m}m`
    },
}))

import { mount } from '@vue/test-utils'
import HistoryAllPrintStatusChart from '@/components/charts/HistoryAllPrintStatusChart.vue'

// A stub e-chart component to register globally
const EChartStub = {
    name: 'EChart',
    props: ['option', 'initOptions', 'autoresize', 'style'],
    template: '<div class="e-chart" :style="style"><slot /></div>',
}

describe('HistoryAllPrintStatusChart.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function createWrapper(props: Record<string, any> = {}) {
        return mount(HistoryAllPrintStatusChart, {
            props,
            global: {
                components: {
                    'e-chart': EChartStub,
                },
                stubs: {
                    'v-observe-visibility': true,
                },
            },
        })
    }

    it('renders the e-chart component', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        expect(wrapper.find('.e-chart').exists()).toBe(true)
    })

    it('has w-100 class on the chart', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        const chart = wrapper.find('.e-chart')
        expect(chart.classes()).toContain('w-100')
    })

    it('applies default height style', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        const chart = wrapper.find('.e-chart')
        expect(chart.attributes('style')).toContain('height: 200px')
    })

    it('renders with valueName prop set to jobs', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        expect(wrapper.find('.e-chart').exists()).toBe(true)
    })

    it('renders with valueName prop set to filament', () => {
        const wrapper = createWrapper({ valueName: 'filament' })
        expect(wrapper.find('.e-chart').exists()).toBe(true)
    })

    it('renders with valueName prop set to time', () => {
        const wrapper = createWrapper({ valueName: 'time' })
        expect(wrapper.find('.e-chart').exists()).toBe(true)
    })

    it('passes autoresize prop as true', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        const chart = wrapper.findComponent(EChartStub)
        expect(chart.props('autoresize')).toBe(true)
    })

    it('passes init-options with svg renderer', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        const chart = wrapper.findComponent(EChartStub)
        expect(chart.props('initOptions')).toEqual({ renderer: 'svg' })
    })

    it('sets option prop with chart options containing pie series and data', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        const chart = wrapper.findComponent(EChartStub)
        const option = chart.props('option') as any
        expect(option).toBeTruthy()
        expect(option.series[0].type).toBe('pie')
        expect(option.series[0].data).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'completed' }),
            expect.objectContaining({ name: 'in_progress' }),
        ]))
    })

    it('chart options disable animation', () => {
        const wrapper = createWrapper({ valueName: 'jobs' })
        const chart = wrapper.findComponent(EChartStub)
        const option = chart.props('option') as any
        expect(option.animation).toBe(false)
    })

    it('renders without a valueName prop (defaults to jobs)', () => {
        const wrapper = createWrapper()
        expect(wrapper.find('.e-chart').exists()).toBe(true)
    })
})
