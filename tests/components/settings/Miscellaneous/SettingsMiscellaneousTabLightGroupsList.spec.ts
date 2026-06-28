import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsMiscellaneousTabLightGroupsList from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroupsList.vue'

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

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroupsListEntry.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabLightGroupsListEntry',
        props: ['type', 'name', 'group'],
        template: '<div class="tab-light-groups-list-entry-stub">{{ group.name }}</div>',
        emits: ['edit-group'],
    },
}))

vi.mock('@/plugins/helpers', () => ({
    caseInsensitiveSort: (arr: any[], key: string) =>
        [...arr].sort((a: any, b: any) =>
            String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { sensitivity: 'base' })
        ),
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

describe('SettingsMiscellaneousTabLightGroupsList.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the headline with the light name', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.MiscellaneousTab.LightGroups')
    })

    it('shows no groups found message when no entries', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.MiscellaneousTab.NoGroupFound')
    })

    it('renders list entries when groups exist', () => {
        const entries = {
            entry1: {
                type: 'neopixel',
                name: 'my_strip',
                lightgroups: {
                    g1: { name: 'Group A', start: 1, end: 5 },
                    g2: { name: 'Group B', start: 6, end: 10 },
                },
            },
        }
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore(entries)],
                mocks: { $t: (key: string) => key },
            },
        })
        const listEntries = wrapper.findAllComponents({ name: 'SettingsMiscellaneousTabLightGroupsListEntry' })
        expect(listEntries.length).toBe(2)
    })

    it('emits create-group on add group button click', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const addBtn = wrapper.findAll('.v-btn').at(-1)
        await addBtn!.trigger('click')
        expect(wrapper.emitted('create-group')).toBeTruthy()
    })

    it('emits close on close button click', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsList, {
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

    it('emits edit-group when list entry emits edit-group', async () => {
        const entries = {
            entry1: {
                type: 'neopixel',
                name: 'my_strip',
                lightgroups: {
                    g1: { name: 'Group A', start: 1, end: 5 },
                },
            },
        }
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsList, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore(entries)],
                mocks: { $t: (key: string) => key },
            },
        })
        const listEntry = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightGroupsListEntry' })
        await listEntry.vm.$emit('edit-group', 'g1')
        expect(wrapper.emitted('edit-group')).toBeTruthy()
        expect(wrapper.emitted('edit-group')?.[0]).toEqual(['g1'])
    })
})
