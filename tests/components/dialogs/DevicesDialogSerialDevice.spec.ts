import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', props: ['variant'], template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VListItem: { name: 'VListItem', props: ['lines'], template: '<div><slot name="title" /><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

vi.mock('@/components/inputs/TextfieldWithCopy.vue', () => ({
    default: {
        name: 'TextfieldWithCopy',
        props: ['label', 'value'],
        template: '<div class="textfield-copy">{{ label }}: {{ value }}</div>',
    },
}))

const i18n = createI18n({
    legacy: false, locale: 'en',
    messages: { en: { DevicesDialog: { DevicePath: 'Device Path', PathById: 'Path by ID', PathByHardware: 'Path by Hardware' } } },
})

import DevicesDialogSerialDevice from '@/components/dialogs/DevicesDialogSerialDevice.vue'

describe('DevicesDialogSerialDevice.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(DevicesDialogSerialDevice, {
            props: {
                device: {
                    device_type: 'serial',
                    device_name: 'ttyUSB0',
                    device_path: '/dev/ttyUSB0',
                    driver_name: 'ch341',
                },
            },
            global: { plugins: [i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders device name and type', () => {
        const wrapper = mount(DevicesDialogSerialDevice, {
            props: {
                device: {
                    device_type: 'serial',
                    device_name: 'ttyUSB0',
                    device_path: '/dev/ttyUSB0',
                    driver_name: 'ch341',
                },
            },
            global: { plugins: [i18n] },
        })
        expect(wrapper.text()).toContain('ttyUSB0')
        expect(wrapper.text()).toContain('SERIAL')
        expect(wrapper.text()).toContain('ch341')
    })

    it('renders device path', () => {
        const wrapper = mount(DevicesDialogSerialDevice, {
            props: {
                device: {
                    device_type: 'serial',
                    device_name: 'ttyAMA0',
                    device_path: '/dev/ttyAMA0',
                    driver_name: 'pl011',
                },
            },
            global: { plugins: [i18n] },
        })
        expect(wrapper.text()).toContain('/dev/ttyAMA0')
    })
})
