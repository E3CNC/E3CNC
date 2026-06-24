import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsMiscellaneousTabLightPresetsList from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresetsList.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VBtn: { name: 'VBtn', props: ['variant', 'color'], template: '<button class="v-btn"><slot /></button>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<div class="v-spacer" />' },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
}))

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresetsListEntry.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabLightPresetsListEntry',
        props: ['type', 'name', 'preset'],
        template: '<div class="tab-light-presets-list-entry-stub">{{ preset.name }}</div>',
        emits: ['edit-preset'],
    },
}))

vi.mock('@/plugins/helpers', () => ({
    caseInsensitiveSort: (arr: any[], key: string) =>
        [...arr].sort((a: any, b: any) => String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { sensitivity: 'base' })),
}))

function createMockStore(entries: Record<string, any> = {}) {
    return createStore({
        state: {
            gui: {
                miscellaneous: {
                    entries,
                },
            },
        },
    })
}

describe('SettingsMiscellaneousTabLightPresetsList.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the headline with the light name', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.MiscellaneousTab.LightPresets')
    })

    it('shows no presets found message when no entries', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.MiscellaneousTab.NoPresetFound')
    })

    it('renders list entries when presets exist', () => {
        const entries = {
            entry1: {
                type: 'neopixel',
                name: 'my_strip',
                presets: {
                    p1: { name: 'Red', red: 255, green: 0, blue: 0, white: 0 },
                    p2: { name: 'Green', red: 0, green: 255, blue: 0, white: 0 },
                },
            },
        }
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore(entries)],
                mocks: { $t: (key: string) => key },
            },
        })
        const listEntries = wrapper.findAllComponents({ name: 'SettingsMiscellaneousTabLightPresetsListEntry' })
        expect(listEntries.length).toBe(2)
    })

    it('emits create-preset on add preset button click', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const addBtn = wrapper.findAll('.v-btn').at(-1)
        await addBtn!.trigger('click')
        expect(wrapper.emitted('create-preset')).toBeTruthy()
    })

    it('emits close on close button click', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const closeBtn = wrapper.findAll('.v-btn')[0]
        await closeBtn.trigger('click')
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits edit-preset when list entry emits edit-preset', async () => {
        const entries = {
            entry1: {
                type: 'neopixel',
                name: 'my_strip',
                presets: {
                    p1: { name: 'Red', red: 255, green: 0, blue: 0, white: 0 },
                },
            },
        }
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore(entries)],
                mocks: { $t: (key: string) => key },
            },
        })
        const listEntry = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightPresetsListEntry' })
        await listEntry.vm.$emit('edit-preset', 'p1')
        expect(wrapper.emitted('edit-preset')).toBeTruthy()
        expect(wrapper.emitted('edit-preset')?.[0]).toEqual(['p1'])
    })
})
