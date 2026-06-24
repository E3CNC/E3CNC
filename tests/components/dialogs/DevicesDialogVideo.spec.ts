import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ apiUrl: { value: 'http://localhost:8080' } }),
}))

vi.mock('@/components/dialogs/DevicesDialogVideoDeviceLibcamera.vue', () => ({
    default: {
        name: 'DevicesDialogVideoDeviceLibcamera',
        props: ['device'],
        template: '<div class="libcamera-device-stub" />',
    },
}))

vi.mock('@/components/dialogs/DevicesDialogVideoDeviceV4l2.vue', () => ({
    default: {
        name: 'DevicesDialogVideoDeviceV4l2',
        props: ['device'],
        template: '<div class="v4l2-device-stub" />',
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

import DevicesDialogVideo from '@/components/dialogs/DevicesDialogVideo.vue'

describe('DevicesDialogVideo.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(DevicesDialogVideo, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders refresh button', () => {
        const wrapper = mount(DevicesDialogVideo, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.v-btn').exists()).toBe(true)
    })

    it('shows click refresh message initially', () => {
        const wrapper = mount(DevicesDialogVideo, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('DevicesDialog.ClickRefresh')
    })

    it('shows no device found when loaded empty', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    result: { v4l2_devices: [], libcamera_devices: [] },
                }),
        })
        const wrapper = mount(DevicesDialogVideo, {
            global: { mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('.v-btn').trigger('click')
        await new Promise((r) => setTimeout(r, 10))
        expect(wrapper.text()).toContain('DevicesDialog.NoDeviceFound')
    })

    it('renders libcamera devices when fetch returns data', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    result: {
                        v4l2_devices: [],
                        libcamera_devices: [{ libcamera_id: '/base/soc/i2c0mux' }],
                    },
                }),
        })
        const wrapper = mount(DevicesDialogVideo, {
            global: { mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('.v-btn').trigger('click')
        await new Promise((r) => setTimeout(r, 10))
        expect(wrapper.find('.libcamera-device-stub').exists()).toBe(true)
    })

    it('renders v4l2 devices when fetch returns data', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    result: {
                        v4l2_devices: [{ hardware_bus: 'platform:fe801000' }],
                        libcamera_devices: [],
                    },
                }),
        })
        const wrapper = mount(DevicesDialogVideo, {
            global: { mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('.v-btn').trigger('click')
        await new Promise((r) => setTimeout(r, 10))
        expect(wrapper.find('.v4l2-device-stub').exists()).toBe(true)
    })
})
