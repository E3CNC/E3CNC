import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import MoonrakerSensorValue from '@/components/panels/Miscellaneous/MoonrakerSensorValue.vue'

vi.mock('@/plugins/helpers', () => ({
    convertName: (s: string) => s.replace(/_/g, ' '),
    unitToSymbol: (s: string | null) => (s === '°C' ? 'thermometer' : 'help'),
}))

vi.mock('vuetify/components', () => ({
    VIcon: {
        name: 'VIcon',
        props: { size: String, start: Boolean, icon: String },
        template: '<i class="v-icon"><slot /></i>',
    },
}))

function makeStore(sensors: Record<string, any> = {}, config: Record<string, any> = {}) {
    return createStore({
        state: {
            server: {
                sensor: { sensors },
                config: { config },
            },
            klippy_connected: true,
            klippy_state: 'ready',
        },
    })
}

describe('MoonrakerSensorValue.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('mounts without crashing', () => {
        const wrapper = mount(MoonrakerSensorValue, {
            props: { sensor: 'mysensor', valueName: 'temperature' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders value from sensor data', () => {
        const wrapper = mount(MoonrakerSensorValue, {
            props: { sensor: 'mysensor', valueName: 'temperature' },
            global: {
                plugins: [makeStore({ mysensor: { values: { temperature: 25.5 } } })],
            },
        })
        expect(wrapper.text()).toContain('25.5')
    })

    it('renders -- when value is missing', () => {
        const wrapper = mount(MoonrakerSensorValue, {
            props: { sensor: 'mysensor', valueName: 'temperature' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toContain('--')
    })

    it('renders converted name (underscores to spaces)', () => {
        const wrapper = mount(MoonrakerSensorValue, {
            props: { sensor: 'mysensor', valueName: 'bed_temperature' },
            global: {
                plugins: [makeStore({ mysensor: { values: { bed_temperature: 60 } } })],
            },
        })
        expect(wrapper.text()).toContain('bed temperature')
    })

    it('displays unit from config', () => {
        const wrapper = mount(MoonrakerSensorValue, {
            props: { sensor: 'mysensor', valueName: 'temperature' },
            global: {
                plugins: [
                    makeStore(
                        { mysensor: { values: { temperature: 25.5 } } },
                        { 'sensor mysensor': { parameter_temperature: { units: '°C' } } }
                    ),
                ],
            },
        })
        expect(wrapper.text()).toContain('°C')
    })
})
