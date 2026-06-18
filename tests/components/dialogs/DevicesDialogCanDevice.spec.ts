import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', props: ['variant'], template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
}))

vi.mock('@/components/inputs/TextfieldWithCopy.vue', () => ({
    default: {
        name: 'TextfieldWithCopy',
        props: ['label', 'value'],
        template: '<div class="textfield-copy">{{ label }}: {{ value }}</div>',
    },
}))

import DevicesDialogCanDevice from '@/components/dialogs/DevicesDialogCanDevice.vue'

describe('DevicesDialogCanDevice.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(DevicesDialogCanDevice, {
            props: {
                device: { uuid: 'abc-123', application: 'Klipper' },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders application name', () => {
        const wrapper = mount(DevicesDialogCanDevice, {
            props: {
                device: { uuid: 'abc-123', application: 'Klipper' },
            },
        })
        expect(wrapper.text()).toContain('Klipper')
    })

    it('renders UUID', () => {
        const wrapper = mount(DevicesDialogCanDevice, {
            props: {
                device: { uuid: 'my-uuid-123', application: 'Moonraker' },
            },
        })
        expect(wrapper.text()).toContain('UUID')
        expect(wrapper.text()).toContain('my-uuid-123')
    })
})
