import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import TemperaturePanelListItemAdditionalSensorValue from '@/components/panels/Temperature/TemperaturePanelListItemAdditionalSensorValue.vue'

const getDatasetAdditionalSensorValue = vi.fn(() => true)

function makeStore() {
    return createStore({
        getters: {
            'gui/getDatasetAdditionalSensorValue': () => getDatasetAdditionalSensorValue,
        },
    })
}

describe('TemperaturePanelListItemAdditionalSensorValue.vue', () => {
    beforeEach(() => { vi.clearAllMocks(); getDatasetAdditionalSensorValue.mockReturnValue(true) })

    it('mounts without crashing', () => {
        const wrapper = mount(TemperaturePanelListItemAdditionalSensorValue, {
            props: { printerObject: {}, objectName: 'sensor', keyName: 'temperature' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders formatted value when visible', () => {
        const wrapper = mount(TemperaturePanelListItemAdditionalSensorValue, {
            props: { printerObject: { temperature: 25.5 }, objectName: 'sensor', keyName: 'temperature' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toContain('25.5')
    })

    it('formats pressure with hPa unit', () => {
        const wrapper = mount(TemperaturePanelListItemAdditionalSensorValue, {
            props: { printerObject: { pressure: 1013.25 }, objectName: 'sensor', keyName: 'pressure' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toContain('hPa')
        expect(wrapper.text()).toContain('1013.3')
    })

    it('formats humidity with % unit', () => {
        const wrapper = mount(TemperaturePanelListItemAdditionalSensorValue, {
            props: { printerObject: { humidity: 45 }, objectName: 'sensor', keyName: 'humidity' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toContain('%')
    })

    it('formats current_z_adjust with mm unit', () => {
        const wrapper = mount(TemperaturePanelListItemAdditionalSensorValue, {
            props: { printerObject: { current_z_adjust: 0.25 }, objectName: 'sensor', keyName: 'current_z_adjust' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toContain('mm')
        expect(wrapper.text()).toContain('0.250')
    })

    it('formats small z_adjust (< 0.1) as μm', () => {
        const wrapper = mount(TemperaturePanelListItemAdditionalSensorValue, {
            props: { printerObject: { current_z_adjust: 0.05 }, objectName: 'sensor', keyName: 'current_z_adjust' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toContain('μm')
        expect(wrapper.text()).toContain('50')
    })

    it('hides when value is null', () => {
        const wrapper = mount(TemperaturePanelListItemAdditionalSensorValue, {
            props: { printerObject: { temperature: null }, objectName: 'sensor', keyName: 'temperature' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toBe('')
    })

    it('hides when value is NaN', () => {
        const wrapper = mount(TemperaturePanelListItemAdditionalSensorValue, {
            props: { printerObject: { temperature: Number.NaN }, objectName: 'sensor', keyName: 'temperature' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toBe('')
    })

    it('hides when GUI setting is false', () => {
        getDatasetAdditionalSensorValue.mockReturnValue(false)
        const wrapper = mount(TemperaturePanelListItemAdditionalSensorValue, {
            props: { printerObject: { temperature: 25 }, objectName: 'sensor', keyName: 'temperature' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toBe('')
    })
})
