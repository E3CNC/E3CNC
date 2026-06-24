import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsMiscellaneousTabLightPresetsListEntry from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresetsListEntry.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiDelete: 'mdi-delete',
    mdiPencil: 'mdi-pencil',
}))

vi.mock('vuetify/components', () => ({
    VBtn: { name: 'VBtn', props: ['size', 'variant', 'color'], template: '<button class="v-btn"><slot /></button>' },
    VIcon: { name: 'VIcon', props: ['size'], template: '<i class="v-icon"><slot /></i>' },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: ['title', 'subTitle', 'dynamicSlotWidth'],
        template: '<div class="settings-row"><span class="settings-row-title">{{ title }}</span><span class="settings-row-subtitle">{{ subTitle }}</span><slot /></div>',
    },
}))

describe('SettingsMiscellaneousTabLightPresetsListEntry.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        store = createStore({
            state: {
                printer: {
                    configfile: {
                        settings: {
                            'neopixel my_strip': {
                                color_order: ['RGB'],
                            },
                        },
                    },
                },
            },
        })
    })

    it('renders without crashing', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                preset: { id: 'p1', name: 'Test Preset', red: 255, green: 0, blue: 0, white: 0 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the preset name', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                preset: { id: 'p1', name: 'Test Preset', red: 255, green: 0, blue: 0, white: 0 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.settings-row-title').text()).toBe('Test Preset')
    })

    it('renders subtitle with color values based on colorOrder', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                preset: { id: 'p1', name: 'Test Preset', red: 255, green: 0, blue: 128, white: 0 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        // color_order is RGB so we should see R, G, B
        expect(wrapper.find('.settings-row-subtitle').text()).toContain('R: 255')
        expect(wrapper.find('.settings-row-subtitle').text()).toContain('G: 0')
        expect(wrapper.find('.settings-row-subtitle').text()).toContain('B: 128')
    })

    it('renders edit and delete buttons', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                preset: { id: 'p1', name: 'Test Preset', red: 255, green: 0, blue: 0, white: 0 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAll('.v-btn')
        expect(buttons.length).toBe(2)
    })

    it('emits edit-preset on edit button click', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                preset: { id: 'p1', name: 'Test Preset', red: 255, green: 0, blue: 0, white: 0 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const editBtn = wrapper.findAll('.v-btn')[0]
        await editBtn.trigger('click')
        expect(wrapper.emitted('edit-preset')).toBeTruthy()
        expect(wrapper.emitted('edit-preset')?.[0]).toEqual(['p1'])
    })

    it('dispatches deletePreset on delete button click', async () => {
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                preset: { id: 'p1', name: 'Test Preset', red: 255, green: 0, blue: 0, white: 0 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const deleteBtn = wrapper.findAll('.v-btn')[1]
        await deleteBtn.trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/miscellaneous/deletePreset', {
            type: 'neopixel',
            name: 'my_strip',
            presetId: 'p1',
        })
    })
})
