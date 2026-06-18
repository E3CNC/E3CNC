import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', props: ['variant'], template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
    VListItem: { name: 'VListItem', props: ['lines'], template: '<div><slot name="title" /><slot /></div>' },
}))

vi.mock('@/components/inputs/TextfieldWithCopy.vue', () => ({
    default: {
        name: 'TextfieldWithCopy',
        props: ['label', 'value'],
        template: '<div class="textfield-copy">{{ label }}: {{ value }}</div>',
    },
}))

import DevicesDialogUsbDevice from '@/components/dialogs/DevicesDialogUsbDevice.vue'

describe('DevicesDialogUsbDevice.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(DevicesDialogUsbDevice, {
            props: {
                device: {
                    manufacturer: 'Test Corp',
                    product: 'Test Device',
                    serial_number: 'SN123',
                },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders manufacturer and product', () => {
        const wrapper = mount(DevicesDialogUsbDevice, {
            props: {
                device: {
                    manufacturer: 'Arduino',
                    product: 'Uno',
                    serial_number: 'ABC123',
                },
            },
        })
        expect(wrapper.text()).toContain('Arduino')
        expect(wrapper.text()).toContain('Uno')
    })
})
