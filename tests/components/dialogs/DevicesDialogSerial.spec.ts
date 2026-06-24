import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ apiUrl: { value: 'http://localhost:8080' } }),
}))

vi.mock('@/components/dialogs/DevicesDialogSerialDevice.vue', () => ({
    default: {
        name: 'DevicesDialogSerialDevice',
        props: ['device'],
        template: '<div class="serial-device-stub" />',
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
    VExpansionPanels: { name: 'VExpansionPanels', template: '<div class="v-expansion-panels"><slot /></div>' },
}))

import DevicesDialogSerial from '@/components/dialogs/DevicesDialogSerial.vue'

describe('DevicesDialogSerial.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(DevicesDialogSerial, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders refresh button', () => {
        const wrapper = mount(DevicesDialogSerial, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.v-btn').exists()).toBe(true)
        expect(wrapper.text()).toContain('DevicesDialog.Refresh')
    })

    it('shows click refresh message initially', () => {
        const wrapper = mount(DevicesDialogSerial, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('DevicesDialog.ClickRefresh')
    })

    it('shows no device found when loaded with empty devices', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ result: { serial_devices: [] } }),
        })
        const wrapper = mount(DevicesDialogSerial, {
            global: { mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('.v-btn').trigger('click')
        await new Promise((r) => setTimeout(r, 10))
        expect(wrapper.text()).toContain('DevicesDialog.NoDeviceFound')
    })

    it('renders serial devices when fetch returns data', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    result: {
                        serial_devices: [
                            { device_path: '/dev/ttyUSB0', device_type: 'usb' },
                        ],
                    },
                }),
        })
        const wrapper = mount(DevicesDialogSerial, {
            global: { mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('.v-btn').trigger('click')
        await new Promise((r) => setTimeout(r, 10))
        expect(wrapper.find('.v-expansion-panels').exists()).toBe(true)
    })
})
