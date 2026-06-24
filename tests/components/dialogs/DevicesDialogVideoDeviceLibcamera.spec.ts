import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@/components/inputs/TextfieldWithCopy.vue', () => ({
    default: {
        name: 'TextfieldWithCopy',
        props: ['label', 'value'],
        template: '<div class="textfield-copy-stub">{{ label }}: {{ value }}</div>',
    },
}))

vi.mock('@/plugins/helpers', () => ({
    sortResolutions: (a: string, b: string) => {
        const [aw, ah] = a.split('x').map(Number)
        const [bw, bh] = b.split('x').map(Number)
        return bw - aw || bh - ah
    },
}))

vi.mock('vuetify/components', () => ({
    VCard: {
        name: 'VCard',
        props: ['variant'],
        template: '<div class="v-card"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VListItem: {
        name: 'VListItem',
        template: '<div class="v-list-item"><slot name="title" /><slot /></div>',
    },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
}))

import DevicesDialogVideoDeviceLibcamera from '@/components/dialogs/DevicesDialogVideoDeviceLibcamera.vue'

const sampleDevice = {
    model: 'Camera Model',
    libcamera_id: '/base/soc/i2c0mux/IMX219',
    modes: [
        { format: 'SBGGR10', resolutions: ['1640x1232', '640x480', '1920x1080', '1280x720'] },
        { format: 'SBGGR10', resolutions: ['1640x1232', '640x480', '1920x1080', '1280x720'] },
    ],
}

describe('DevicesDialogVideoDeviceLibcamera.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(DevicesDialogVideoDeviceLibcamera, {
            props: { device: sampleDevice },
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders device model as title', () => {
        const wrapper = mount(DevicesDialogVideoDeviceLibcamera, {
            props: { device: sampleDevice },
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Camera Model')
    })

    it('renders LibcameraId', () => {
        const wrapper = mount(DevicesDialogVideoDeviceLibcamera, {
            props: { device: sampleDevice },
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.textfield-copy-stub').exists()).toBe(true)
    })

    it('shows identical resolutions when all modes have same resolutions', () => {
        const wrapper = mount(DevicesDialogVideoDeviceLibcamera, {
            props: { device: sampleDevice },
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('DevicesDialog.Formats')
        expect(wrapper.text()).toContain('DevicesDialog.Resolutions')
    })

    it('shows per-mode resolutions when modes differ', () => {
        const device = {
            ...sampleDevice,
            modes: [
                { format: 'SBGGR10', resolutions: ['1640x1232', '640x480'] },
                { format: 'YUYV', resolutions: ['1920x1080', '1280x720'] },
            ],
        }
        const wrapper = mount(DevicesDialogVideoDeviceLibcamera, {
            props: { device },
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('SBGGR10')
        expect(wrapper.text()).toContain('YUYV')
    })
})
