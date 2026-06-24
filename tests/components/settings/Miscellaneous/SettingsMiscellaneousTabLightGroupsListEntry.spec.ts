import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsMiscellaneousTabLightGroupsListEntry from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroupsListEntry.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiDelete: 'mdi-delete',
    mdiPencil: 'mdi-pencil',
}))

vi.mock('vuetify/components', () => ({
    VBtn: { name: 'VBtn', props: ['size', 'variant', 'color'], template: '<button class="v-btn" :class="\'v-btn--size-\' + $props.size"><slot /></button>' },
    VIcon: { name: 'VIcon', props: ['size'], template: '<i class="v-icon"><slot /></i>' },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: ['title', 'subTitle', 'dynamicSlotWidth'],
        template: '<div class="settings-row"><span class="settings-row-title">{{ title }}</span><span class="settings-row-subtitle">{{ subTitle }}</span><slot /></div>',
    },
}))

describe('SettingsMiscellaneousTabLightGroupsListEntry.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        store = createStore({
            state: {},
            getters: {},
        })
    })

    it('renders without crashing', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                group: { id: 'g1', name: 'Test Group', start: 1, end: 5 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the group name', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                group: { id: 'g1', name: 'Test Group', start: 1, end: 5 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.settings-row-title').text()).toBe('Test Group')
    })

    it('renders subtitle with start and end values', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                group: { id: 'g1', name: 'Test Group', start: 1, end: 5 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.MiscellaneousTab.GroupSubTitle')
    })

    it('renders edit and delete buttons', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                group: { id: 'g1', name: 'Test Group', start: 1, end: 5 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAll('.v-btn')
        expect(buttons.length).toBe(2)
    })

    it('emits edit-group on edit button click', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                group: { id: 'g1', name: 'Test Group', start: 1, end: 5 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const editBtn = wrapper.findAll('.v-btn')[0]
        await editBtn.trigger('click')
        expect(wrapper.emitted('edit-group')).toBeTruthy()
        expect(wrapper.emitted('edit-group')?.[0]).toEqual(['g1'])
    })

    it('dispatches deleteLightgroup on delete button click', async () => {
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsListEntry, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                group: { id: 'g1', name: 'Test Group', start: 1, end: 5 },
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const deleteBtn = wrapper.findAll('.v-btn')[1]
        await deleteBtn.trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/miscellaneous/deleteLightgroup', {
            type: 'neopixel',
            name: 'my_strip',
            lightgroupId: 'g1',
        })
    })
})
