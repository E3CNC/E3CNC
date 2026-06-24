import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsMiscellaneousTabLightPresets from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresets.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresetsForm.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabLightPresetsForm',
        props: ['type', 'name', 'presetId'],
        template: '<div class="tab-light-presets-form-stub">Form</div>',
        emits: ['close'],
    },
}))

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresetsList.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabLightPresetsList',
        props: ['type', 'name'],
        template: '<div class="tab-light-presets-list-stub">List</div>',
        emits: ['create-preset', 'edit-preset', 'close'],
    },
}))

describe('SettingsMiscellaneousTabLightPresets.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the list view by default', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresets, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        expect(wrapper.find('.tab-light-presets-list-stub').exists()).toBe(true)
        expect(wrapper.find('.tab-light-presets-form-stub').exists()).toBe(false)
    })

    it('shows form when create-preset is emitted from list', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresets, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightPresetsList' })
        await listComp.vm.$emit('create-preset')
        expect(wrapper.find('.tab-light-presets-form-stub').exists()).toBe(true)
    })

    it('shows form when edit-preset is emitted from list', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresets, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightPresetsList' })
        await listComp.vm.$emit('edit-preset', 'preset-123')
        expect(wrapper.find('.tab-light-presets-form-stub').exists()).toBe(true)
    })

    it('returns to list from form when close is emitted', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresets, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightPresetsList' })
        await listComp.vm.$emit('create-preset')
        expect(wrapper.find('.tab-light-presets-form-stub').exists()).toBe(true)

        const formComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightPresetsForm' })
        await formComp.vm.$emit('close')
        expect(wrapper.find('.tab-light-presets-list-stub').exists()).toBe(true)
    })

    it('emits close when list emits close', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresets, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightPresetsList' })
        await listComp.vm.$emit('close')
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('passes presetId to form when editing', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresets, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightPresetsList' })
        await listComp.vm.$emit('edit-preset', 'preset-456')
        const formComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightPresetsForm' })
        expect(formComp.props('presetId')).toBe('preset-456')
    })
})
