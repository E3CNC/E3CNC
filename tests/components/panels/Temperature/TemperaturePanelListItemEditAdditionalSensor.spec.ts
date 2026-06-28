import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import TemperaturePanelListItemEditAdditionalSensor from '@/components/panels/Temperature/TemperaturePanelListItemEditAdditionalSensor.vue'

const vuetifyComponentsMock = vi.hoisted(() => ({
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VCheckbox: {
        name: 'VCheckbox',
        props: { modelValue: Boolean, label: String, hideDetails: Boolean, class: String },
        template:
            '<input type="checkbox" :checked="modelValue" :data-label="label" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Panels: {
                TemperaturePanel: {
                    ShowNameInList: 'Show {name} in list',
                },
            },
        },
    },
})

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            gui: {},
            ...overrides,
        },
        getters: {
            'gui/getDatasetAdditionalSensorValue': () => (params: { name: string; type: string }) => {
                if (params.name === 'extruder' && params.type === 'sensor1') return true
                return false
            },
            ...(overrides.getters || {}),
        },
    })
}

describe('TemperaturePanelListItemEditAdditionalSensor.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(TemperaturePanelListItemEditAdditionalSensor, {
            props: { objectName: 'extruder', additionalSensor: 'sensor1' },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders a checkbox with the translated label', () => {
        const store = createStoreWithState()
        const wrapper = mount(TemperaturePanelListItemEditAdditionalSensor, {
            props: { objectName: 'extruder', additionalSensor: 'sensor1' },
            global: { plugins: [store, i18n] },
        })
        const checkbox = wrapper.find('input[type="checkbox"]')
        expect(checkbox.exists()).toBe(true)
        expect(checkbox.attributes('data-label')).toContain('sensor1')
    })

    it('checkbox reflects the getter value', () => {
        const store = createStoreWithState()
        const wrapper = mount(TemperaturePanelListItemEditAdditionalSensor, {
            props: { objectName: 'extruder', additionalSensor: 'sensor1' },
            global: { plugins: [store, i18n] },
        })
        const checkbox = wrapper.find('input[type="checkbox"]')
        expect((checkbox.element as HTMLInputElement).checked).toBe(true)
    })

    it('dispatches action on checkbox change', async () => {
        const dispatchSpy = vi.fn()
        const store = createStoreWithState()
        store.dispatch = dispatchSpy

        const wrapper = mount(TemperaturePanelListItemEditAdditionalSensor, {
            props: { objectName: 'extruder', additionalSensor: 'sensor1' },
            global: { plugins: [store, i18n] },
        })
        const checkbox = wrapper.find('input[type="checkbox"]')
        await checkbox.setValue(false)

        expect(dispatchSpy).toHaveBeenCalledWith('gui/setDatasetAdditionalSensorStatus', {
            objectName: 'extruder',
            dataset: 'sensor1',
            value: false,
        })
    })
})
