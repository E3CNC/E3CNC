import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsMiscellaneousTabLightGroups from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroups.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroupsForm.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabLightGroupsForm',
        props: ['type', 'name', 'groupId'],
        template: '<div class="tab-light-groups-form-stub">Form</div>',
        emits: ['close'],
    },
}))

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroupsList.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabLightGroupsList',
        props: ['type', 'name'],
        template: '<div class="tab-light-groups-list-stub">List</div>',
        emits: ['create-group', 'edit-group', 'close'],
    },
}))

describe('SettingsMiscellaneousTabLightGroups.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the list view by default', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroups, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        expect(wrapper.find('.tab-light-groups-list-stub').exists()).toBe(true)
        expect(wrapper.find('.tab-light-groups-form-stub').exists()).toBe(false)
    })

    it('shows form when create-group is emitted from list', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroups, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        // Find the list component stub and emit create-group
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightGroupsList' })
        await listComp.vm.$emit('create-group')
        expect(wrapper.find('.tab-light-groups-form-stub').exists()).toBe(true)
    })

    it('shows form when edit-group is emitted from list', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroups, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightGroupsList' })
        await listComp.vm.$emit('edit-group', 'group-123')
        expect(wrapper.find('.tab-light-groups-form-stub').exists()).toBe(true)
    })

    it('returns to list from form when close is emitted from form', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroups, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        // Go to form by emitting create-group
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightGroupsList' })
        await listComp.vm.$emit('create-group')
        expect(wrapper.find('.tab-light-groups-form-stub').exists()).toBe(true)

        // Go back to list by emitting close from form
        const formComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightGroupsForm' })
        await formComp.vm.$emit('close')
        expect(wrapper.find('.tab-light-groups-list-stub').exists()).toBe(true)
    })

    it('emits close when list emits close', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroups, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightGroupsList' })
        await listComp.vm.$emit('close')
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('passes groupId to form when editing', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroups, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        const listComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightGroupsList' })
        await listComp.vm.$emit('edit-group', 'group-123')
        const formComp = wrapper.findComponent({ name: 'SettingsMiscellaneousTabLightGroupsForm' })
        expect(formComp.props('groupId')).toBe('group-123')
    })
})
