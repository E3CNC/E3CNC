import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { mdiCloseThick } from '@mdi/js'
import TemperaturePanelListItemEdit from '@/components/panels/Temperature/TemperaturePanelListItemEdit.vue'

const vuetifyComponentsMock = vi.hoisted(() => ({
    VDialog: {
        name: 'VDialog',
        props: { modelValue: Boolean, persistent: Boolean, width: [String, Number] },
        template: '<div v-if="modelValue"><slot /></div>',
    },
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: { icon: [String, Boolean], rounded: String },
        template: '<button :data-icon="icon" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VColorPicker: {
        name: 'VColorPicker',
        props: { modelValue: [String, Object], hideModeSwitch: Boolean, mode: String, class: String },
        template:
            '<input type="color" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@mdi/js', () => ({
    mdiCloseThick: 'MdiCloseThick',
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { title: [String, Object], icon: String, cardClass: String, marginBottom: Boolean },
        template: '<div class="mock-panel"><slot name="buttons" /><slot /></div>',
    },
}))

vi.mock('@/components/panels/Temperature/TemperaturePanelListItemEditChartSerie.vue', () => ({
    default: {
        name: 'TemperaturePanelListItemEditChartSerie',
        props: ['objectName', 'serieName'],
        template: '<div class="chart-serie-item">{{ serieName }}</div>',
    },
}))

vi.mock('@/components/panels/Temperature/TemperaturePanelListItemEditAdditionalSensor.vue', () => ({
    default: {
        name: 'TemperaturePanelListItemEditAdditionalSensor',
        props: ['objectName', 'additionalSensor'],
        template: '<div class="additional-sensor-item">{{ additionalSensor }}</div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {},
    },
})

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            printer: {},
            ...overrides,
        },
        getters: {
            'printer/tempHistory/getSerieNames': () => (objectName: string) => {
                if (objectName === 'extruder') return ['temperature', 'target', 'power']
                return []
            },
            ...(overrides.getters || {}),
        },
    })
}

describe('TemperaturePanelListItemEdit.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders nothing when showDialog is false', () => {
        const store = createStoreWithState()
        const wrapper = mount(TemperaturePanelListItemEdit, {
            props: {
                showDialog: false,
                objectName: 'extruder',
                name: 'extruder',
                additionalSensorName: null,
                formatName: 'Extruder',
                icon: 'mdiPrinter3d',
                color: '#FF0000',
            },
            global: { plugins: [store, i18n] },
        })
        // With VDialog mocked as v-if="modelValue", content should not render
        expect(wrapper.find('.mock-panel').exists()).toBe(false)
    })

    it('renders panel and chart series when showDialog is true', () => {
        const store = createStoreWithState()
        const wrapper = mount(TemperaturePanelListItemEdit, {
            props: {
                showDialog: true,
                objectName: 'extruder',
                name: 'extruder',
                additionalSensorName: null,
                formatName: 'Extruder',
                icon: 'mdiPrinter3d',
                color: '#FF0000',
            },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.find('.mock-panel').exists()).toBe(true)
        // Chart series should be rendered
        const chartSeries = wrapper.findAll('.chart-serie-item')
        expect(chartSeries.length).toBe(3)
        expect(chartSeries[0].text()).toBe('temperature')
    })

    it('renders close button and emits close on click', async () => {
        const store = createStoreWithState()
        const wrapper = mount(TemperaturePanelListItemEdit, {
            props: {
                showDialog: true,
                objectName: 'extruder',
                name: 'extruder',
                additionalSensorName: null,
                formatName: 'Extruder',
                icon: 'mdiPrinter3d',
                color: '#FF0000',
            },
            global: { plugins: [store, i18n] },
        })
        const closeBtn = wrapper.find('button')
        expect(closeBtn.exists()).toBe(true)
        await closeBtn.trigger('click')
        expect(wrapper.emitted('update:model-value')?.[0]).toEqual([false])
    })

    it('renders additional sensors when additionalSensorName is provided', () => {
        const store = createStoreWithState({
            printer: {
                heater_fan: { temperature: 25, some_other: 10 },
            },
        })
        const wrapper = mount(TemperaturePanelListItemEdit, {
            props: {
                showDialog: true,
                objectName: 'heater_fan',
                name: 'Heater Fan',
                additionalSensorName: 'heater_fan',
                formatName: 'Heater Fan',
                icon: 'mdiFan',
                color: '#00FF00',
            },
            global: { plugins: [store, i18n] },
        })
        // Should render additional sensor items (keys other than 'temperature')
        const sensorItems = wrapper.findAll('.additional-sensor-item')
        expect(sensorItems.length).toBeGreaterThanOrEqual(1)
        expect(sensorItems[0].text()).toBe('some_other')
    })

    it('renders color picker', () => {
        const store = createStoreWithState()
        const wrapper = mount(TemperaturePanelListItemEdit, {
            props: {
                showDialog: true,
                objectName: 'extruder',
                name: 'extruder',
                additionalSensorName: null,
                formatName: 'Extruder',
                icon: 'mdiPrinter3d',
                color: '#FF0000',
            },
            global: { plugins: [store, i18n] },
        })
        const colorInput = wrapper.find('input[type="color"]')
        expect(colorInput.exists()).toBe(true)
    })

    it('dispatches color change on color picker update', async () => {
        const dispatchSpy = vi.fn()
        const store = createStoreWithState()
        store.dispatch = dispatchSpy

        // Mock setTimeout to run immediately
        vi.useFakeTimers()

        const wrapper = mount(TemperaturePanelListItemEdit, {
            props: {
                showDialog: true,
                objectName: 'extruder',
                name: 'extruder',
                additionalSensorName: null,
                formatName: 'Extruder',
                icon: 'mdiPrinter3d',
                color: '#FF0000',
            },
            global: { plugins: [store, i18n] },
        })
        const colorInput = wrapper.find('input[type="color"]')
        await colorInput.setValue('#00FF00')

        // Fast-forward the debounce timer
        vi.runAllTimers()

        expect(dispatchSpy).toHaveBeenCalledWith('gui/setChartColor', {
            objectName: 'extruder',
            value: '#00ff00',
        })
        expect(dispatchSpy).toHaveBeenCalledWith('printer/tempHistory/setColor', {
            name: 'extruder',
            value: '#00ff00',
        })

        vi.useRealTimers()
    })
})
