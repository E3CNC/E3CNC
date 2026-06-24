import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ apiUrl: { value: 'http://localhost:8080' } }),
}))

vi.mock('@/components/dialogs/DevicesDialogCanDevice.vue', () => ({
    default: {
        name: 'DevicesDialogCanDevice',
        props: ['device'],
        template: '<div class="can-device-stub" />',
    },
}))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: {
        name: 'OverlayScrollbarsComponent',
        template: '<div class="overlayscrollbars"><slot /></div>',
    },
}))

vi.mock('@mdi/js', () => ({ mdiInformationVariantCircle: 'mdiInformationVariantCircle' }))

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: ['loading', 'color'],
        template: '<button class="v-btn" :disabled="loading" @click="$emit(`click`, $event)"><slot /></button>',
    },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VAlert: {
        name: 'VAlert',
        props: ['density', 'variant', 'color', 'icon'],
        template: '<div class="v-alert"><slot /></div>',
    },
}))

import DevicesDialogCan from '@/components/dialogs/DevicesDialogCan.vue'

describe('DevicesDialogCan.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(DevicesDialogCan, {
            props: { name: 'can0' },
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders refresh button', () => {
        const wrapper = mount(DevicesDialogCan, {
            props: { name: 'can0' },
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.v-btn').exists()).toBe(true)
        expect(wrapper.text()).toContain('DevicesDialog.Refresh')
    })

    it('shows click refresh message initially', () => {
        const wrapper = mount(DevicesDialogCan, {
            props: { name: 'can0' },
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('DevicesDialog.ClickRefresh')
    })

    it('shows no device found when loaded with empty devices', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ result: { can_uuids: [] } }),
        })
        const wrapper = mount(DevicesDialogCan, {
            props: { name: 'can0' },
            global: { mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('.v-btn').trigger('click')
        await new Promise((r) => setTimeout(r, 10))
        expect(wrapper.text()).toContain('DevicesDialog.NoDeviceFound')
    })

    it('renders OverlayScrollbarsComponent', () => {
        const wrapper = mount(DevicesDialogCan, {
            props: { name: 'can0' },
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.overlayscrollbars').exists()).toBe(true)
    })

    it('renders info alert when no devices detected', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ result: { can_uuids: [] } }),
        })
        const wrapper = mount(DevicesDialogCan, {
            props: { name: 'can0' },
            global: { mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('.v-btn').trigger('click')
        await new Promise((r) => setTimeout(r, 10))
        expect(wrapper.find('.v-alert').exists()).toBe(true)
    })
})
