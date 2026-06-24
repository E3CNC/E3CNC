import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ apiUrl: { value: 'http://localhost:8080' } }),
}))

vi.mock('@/components/dialogs/DevicesDialogUsbDevice.vue', () => ({
    default: {
        name: 'DevicesDialogUsbDevice',
        props: ['device'],
        template: '<div class="usb-device-stub" />',
    },
}))

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: ['loading', 'color'],
        template: '<button class="v-btn" :disabled="loading" @click="$emit(`click`, $event)"><slot /></button>',
    },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
}))

import DevicesDialogUsb from '@/components/dialogs/DevicesDialogUsb.vue'

describe('DevicesDialogUsb.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(DevicesDialogUsb, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders refresh button', () => {
        const wrapper = mount(DevicesDialogUsb, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.v-btn').exists()).toBe(true)
    })

    it('shows click refresh message initially', () => {
        const wrapper = mount(DevicesDialogUsb, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('DevicesDialog.ClickRefresh')
    })

    it('shows no device found when loaded empty', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ result: { usb_devices: [] } }),
        })
        const wrapper = mount(DevicesDialogUsb, {
            global: { mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('.v-btn').trigger('click')
        await new Promise((r) => setTimeout(r, 10))
        expect(wrapper.text()).toContain('DevicesDialog.NoDeviceFound')
    })

    it('renders USB devices when fetch returns data', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    result: {
                        usb_devices: [{ usb_location: '1-2', class: 'Hub' }],
                    },
                }),
        })
        const wrapper = mount(DevicesDialogUsb, {
            global: { mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('.v-btn').trigger('click')
        await new Promise((r) => setTimeout(r, 10))
        expect(wrapper.find('.usb-device-stub').exists()).toBe(true)
    })
})
