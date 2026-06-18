import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import TempChart from '@/components/charts/TempChart.vue'

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
        hours12Format: new MockRef(false),
        formatTime: new MockRef((ts: number) => {
            const d = new Date(ts)
            return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
        }),
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

vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({
        fgColorHi: { value: 'rgba(255, 255, 255, 0.8)' },
        fgColorMid: { value: 'rgba(255, 255, 255, 0.5)' },
        fgColorLow: { value: 'rgba(255, 255, 255, 0.2)' },
        fgColorFaint: { value: 'rgba(255, 255, 255, 0.1)' },
        bgColor: () => 'rgba(0, 0, 0, 1)',
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

// Mock echarts - the component uses vue-echarts (e-chart)
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

const EChartStub = {
    name: 'EChart',
    props: ['option', 'initOptions', 'autoresize', 'style'],
    template: '<div class="e-chart" :style="style"><slot /></div>',
}

function mountTempChart(store: ReturnType<typeof createStoreWithState>) {
    return mount(TempChart, {
        global: {
            plugins: [store],
            mocks: { $t: (key: string) => key },
            components: { 'e-chart': EChartStub },
        },
    })
}

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: false, initializationList: [], loadings: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: [] },
            printer: {
                print_stats: { state: 'ready' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
                tempHistory: {
                    series: [],
                    source: [],
                },
                ...(overrides.printer || {}),
            },
            gui: {
                view: {
                    tempchart: {
                        autoscale: true,
                    },
                },
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                },
                general: { printername: 'Test' },
                control: {},
                uiSettings: {
                    tempchartHeight: 250,
                },
                navigationSettings: { entries: [] },
            },
            files: {},
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'gui/getPanelExpand': () => () => true,
            'printer/tempHistory/getTemperatureStoreSize': () => 600,
            'printer/getMaxTemp': () => 300,
            'printer/tempHistory/getBoolDisplayPwmAxis': () => false,
            'printer/tempHistory/getSelectedLegends': () => ({}),
            ...(overrides.getters || {}),
        },
    })
}

describe('TempChart.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the e-chart component', () => {
        const store = createStoreWithState()
        const wrapper = mountTempChart(store)

        expect(wrapper.find('.e-chart').exists()).toBe(true)
    })

    it('applies height from uiSettings', () => {
        const store = createStoreWithState()
        const wrapper = mountTempChart(store)

        const chart = wrapper.find('.e-chart')
        expect(chart.attributes('style')).toContain('height: 250px')
    })

    it('renders without data series', () => {
        const store = createStoreWithState()
        const wrapper = mountTempChart(store)

        // Should still render even with empty series/source
        expect(wrapper.find('.e-chart').exists()).toBe(true)
    })

    it('renders with custom height', () => {
        const store = createStoreWithState({
            gui: {
                view: {
                    tempchart: {
                        autoscale: true,
                    },
                },
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                },
                general: { printername: 'Test' },
                control: {},
                uiSettings: {
                    tempchartHeight: 400,
                },
                navigationSettings: { entries: [] },
            },
        })
        const wrapper = mountTempChart(store)

        const chart = wrapper.find('.e-chart')
        expect(chart.attributes('style')).toContain('height: 400px')
    })

    it('has w-100 class', () => {
        const store = createStoreWithState()
        const wrapper = mountTempChart(store)

        expect(wrapper.classes()).toContain('w-100')
    })
})
