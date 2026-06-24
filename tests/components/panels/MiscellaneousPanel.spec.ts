import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import MiscellaneousPanel from '@/components/panels/MiscellaneousPanel.vue'

const mockKlipperReadyForGui = vi.hoisted(() => {
    class MockRef { _value: any; __v_isRef = true; constructor(v: any) { this._value = v } get value() { return this._value } set value(v) { this._value = v } }
    return new MockRef(true)
})
const mockLights = vi.hoisted(() => {
    class MockRef { _value: any; __v_isRef = true; constructor(v: any) { this._value = v } get value() { return this._value } set value(v) { this._value = v } }
    return new MockRef([])
})

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: mockKlipperReadyForGui,
    }),
}))

vi.mock('@/composables/useMiscellaneous', () => ({
    useMiscellaneous: () => ({
        lights: mockLights,
    }),
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], collapsible: Boolean, cardClass: String },
        template: '<div class="panel" :class="cardClass"><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('vuetify/components', () => ({
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
}))

vi.mock('@/components/inputs/MiscellaneousSlider.vue', () => ({
    default: {
        name: 'MiscellaneousSlider',
        props: ['name', 'type', 'target', 'rpm', 'controllable', 'pwm', 'off_below', 'max', 'multi'],
        template: '<div class="misc-slider-stub">{{ name }}</div>',
    },
}))

vi.mock('@/components/panels/Miscellaneous/MiscellaneousLight.vue', () => ({
    default: {
        name: 'MiscellaneousLight',
        props: ['type', 'name'],
        template: '<div class="misc-light-stub">{{ name }}</div>',
    },
}))

vi.mock('@/components/panels/Miscellaneous/MiscellaneousSensor.vue', () => ({
    default: {
        name: 'MiscellaneousSensor',
        props: ['name', 'value', 'unit'],
        template: '<div class="misc-sensor-stub">{{ name }}: {{ value }}{{ unit }}</div>',
    },
}))

vi.mock('@/components/panels/Miscellaneous/MoonrakerSensor.vue', () => ({
    default: {
        name: 'MoonrakerSensor',
        props: ['name'],
        template: '<div class="moonraker-sensor-stub">{{ name }}</div>',
    },
}))

describe('MiscellaneousPanel.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        mockKlipperReadyForGui.value = true
        mockLights.value = []

        store = createStore({
            state: { printer: {} },
            getters: {
                'printer/getMiscellaneous': () => [],
                'printer/getMiscellaneousSensors': () => [],
                'server/sensor/getSensors': () => [],
            },
        })
    })

    it('renders when klipperReadyForGui is true and has miscellaneous', () => {
        store = createStore({
            state: { printer: {} },
            getters: {
                'printer/getMiscellaneous': () => [{ name: 'fan0', type: 'fan', power: 0.5, max_power: 1.0, controllable: true, pwm: true, off_below: 0.1, scale: '1', rpm: null }],
                'printer/getMiscellaneousSensors': () => [],
                'server/sensor/getSensors': () => [],
            },
        })
        const wrapper = mount(MiscellaneousPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('renders when klipperReadyForGui is true and has lights', () => {
        mockLights.value = [{ name: 'LED strip', type: 'led' }]
        const wrapper = mount(MiscellaneousPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('does NOT render when klipperReadyForGui is false', () => {
        mockKlipperReadyForGui.value = false
        const wrapper = mount(MiscellaneousPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('does NOT render when no miscellaneous or lights', () => {
        const wrapper = mount(MiscellaneousPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('renders MiscellaneousSlider for each miscellaneous item', () => {
        store = createStore({
            state: { printer: {} },
            getters: {
                'printer/getMiscellaneous': () => [
                    { name: 'fan0', type: 'fan', power: 0.5, max_power: 1.0, controllable: true, pwm: true, off_below: 0.1, scale: '1', rpm: null },
                    { name: 'fan1', type: 'fan', power: 0.8, max_power: 1.0, controllable: true, pwm: true, off_below: 0.1, scale: '1', rpm: null },
                ],
                'printer/getMiscellaneousSensors': () => [],
                'server/sensor/getSensors': () => [],
            },
        })
        const wrapper = mount(MiscellaneousPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const sliders = wrapper.findAllComponents({ name: 'MiscellaneousSlider' })
        expect(sliders.length).toBe(2)
    })

    it('renders MiscellaneousLight when lights are present', () => {
        mockLights.value = [{ name: 'LED strip', type: 'led' }]
        const wrapper = mount(MiscellaneousPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.findComponent({ name: 'MiscellaneousLight' }).exists()).toBe(true)
    })

    it('renders MiscellaneousSensor when sensors are present (with at least one misc item to show panel)', () => {
        store = createStore({
            state: { printer: {} },
            getters: {
                'printer/getMiscellaneous': () => [{ name: 'fan0', type: 'fan', power: 0.5, max_power: 1.0, controllable: true, pwm: true, off_below: 0.1, scale: '1', rpm: null }],
                'printer/getMiscellaneousSensors': () => [{ name: 'temp_sensor', value: 25.5, unit: 'C' }],
                'server/sensor/getSensors': () => [],
            },
        })
        const wrapper = mount(MiscellaneousPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.findComponent({ name: 'MiscellaneousSensor' }).exists()).toBe(true)
    })

    it('renders MoonrakerSensor when moonraker sensors are present (with misc item)', () => {
        store = createStore({
            state: { printer: {} },
            getters: {
                'printer/getMiscellaneous': () => [{ name: 'fan0', type: 'fan', power: 0.5, max_power: 1.0, controllable: true, pwm: true, off_below: 0.1, scale: '1', rpm: null }],
                'printer/getMiscellaneousSensors': () => [],
                'server/sensor/getSensors': () => ['sensor1', 'sensor2'],
            },
        })
        const wrapper = mount(MiscellaneousPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const moonrakerSensors = wrapper.findAllComponents({ name: 'MoonrakerSensor' })
        expect(moonrakerSensors.length).toBe(2)
    })
})
