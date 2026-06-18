import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', props: ['variant'], template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VListItem: { name: 'VListItem', props: ['lines'], template: '<div><slot name="title" /><slot name="subtitle" /><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
}))

vi.mock('@/plugins/helpers', () => ({
    sortResolutions: (modes: any[]) => modes,
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

import DevicesDialogVideoDeviceV4l2 from '@/components/dialogs/DevicesDialogVideoDeviceV4l2.vue'

describe('DevicesDialogVideoDeviceV4l2.vue', () => {
    const baseDevice = {
        camera_name: 'Camera 1',
        device_path: '/dev/video0',
        modes: [{ description: 'YUYV', format: 'YUYV', resolutions: [[1920, 1080]] }],
        alt_name: '',
        path_by_id: '',
        path_by_hardware: '',
    }

    it('renders without crashing', () => {
        const wrapper = mount(DevicesDialogVideoDeviceV4l2, {
            props: { device: baseDevice },
            global: { plugins: [i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders camera name', () => {
        const wrapper = mount(DevicesDialogVideoDeviceV4l2, {
            props: { device: baseDevice },
            global: { plugins: [i18n] },
        })
        expect(wrapper.text()).toContain('Camera 1')
    })

    it('renders device path', () => {
        const wrapper = mount(DevicesDialogVideoDeviceV4l2, {
            props: { device: { ...baseDevice, device_path: '/dev/video2' } },
            global: { plugins: [i18n] },
        })
        expect(wrapper.text()).toContain('/dev/video2')
    })
})
