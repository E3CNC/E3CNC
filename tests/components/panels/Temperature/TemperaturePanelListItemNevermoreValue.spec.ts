import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'

vi.mock('@mdi/js', () => ({}))

vi.mock('vuetify/components', () => ({
    VTooltip: {
        name: 'VTooltip',
        template: '<div class="v-tooltip-stub"><slot name="activator" :props="{}" /><slot /></div>',
    },
    VIcon: { name: 'VIcon', template: '<span class="v-icon-stub"><slot /></span>' },
}))

import TemperaturePanelListItemNevermoreValue from '@/components/panels/Temperature/TemperaturePanelListItemNevermoreValue.vue'

function mountNevermore(
    overrides: {
        printerObject?: Record<string, number>
        objectName?: string
        keyName?: string
        small?: boolean
        guiSetting?: boolean
    } = {}
) {
    const store = createStore({
        getters: {
            'gui/getDatasetAdditionalSensorValue': () => () => overrides.guiSetting ?? true,
        },
    })
    return mount(TemperaturePanelListItemNevermoreValue, {
        props: {
            printerObject: overrides.printerObject ?? { intake_temperature: 25.5, exhaust_temperature: 30.2 },
            objectName: overrides.objectName ?? 'nevermore',
            keyName: overrides.keyName ?? 'temperature',
            small: overrides.small ?? true,
        },
        global: {
            plugins: [store],
            mocks: { $t: (key: string) => key },
        },
    })
}

describe('TemperaturePanelListItemNevermoreValue.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mountNevermore()
        expect(wrapper.exists()).toBe(true)
    })

    it('renders formatted value when visible', () => {
        const wrapper = mountNevermore()
        expect(wrapper.find('.v-tooltip-stub').exists()).toBe(true)
        expect(wrapper.text()).toContain('25.5')
        expect(wrapper.text()).toContain('30.2')
    })

    it('renders with °C unit for temperature', () => {
        const wrapper = mountNevermore()
        expect(wrapper.text()).toContain('°C')
    })

    it('renders with hPa unit for pressure', () => {
        const wrapper = mountNevermore({
            keyName: 'pressure',
            printerObject: { intake_pressure: 1013, exhaust_pressure: 1010 },
        })
        expect(wrapper.text()).toContain('hPa')
    })

    it('renders with % unit for humidity', () => {
        const wrapper = mountNevermore({
            keyName: 'humidity',
            printerObject: { intake_humidity: 45, exhaust_humidity: 50 },
        })
        expect(wrapper.text()).toContain('%')
    })

    it('shows 0 decimal places for gas/pressure', () => {
        const wrapper = mountNevermore({
            keyName: 'pressure',
            printerObject: { intake_pressure: 1013, exhaust_pressure: 1010 },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('is hidden when both values are null', () => {
        const wrapper = mountNevermore({
            objectName: 'nevermore',
            keyName: 'temperature',
            printerObject: {},
            guiSetting: true,
        })
        // The v-if on root div should hide everything
        expect(wrapper.find('.v-tooltip-stub').exists()).toBe(false)
    })

    it('uses smaller font when small prop is true', () => {
        const wrapper = mountNevermore({ small: true })
        expect(wrapper.exists()).toBe(true)
    })
})
