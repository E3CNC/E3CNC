import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@/composables/useDashboard', () => ({
    useDashboard: () => ({
        getPanelName: (name: string) => name.charAt(0).toUpperCase() + name.slice(1),
        convertPanelnameToIcon: () => 'mdiTest',
    }),
}))

vi.mock('vuetify/components', () => ({
    VListItem: { name: 'VListItem', template: '<div><slot /></div>' },
    VIcon: { name: 'VIcon', props: ['icon', 'color'], template: '<i class="v-icon" />' },
}))

import SettingsDashboardSortableItem from '@/components/settings/Dashboard/SortableItem.vue'

describe('SettingsDashboardSortableItem.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(SettingsDashboardSortableItem, {
            props: { name: 'console', visible: true },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders panel name', () => {
        const wrapper = mount(SettingsDashboardSortableItem, {
            props: { name: 'console', visible: true },
        })
        expect(wrapper.text()).toContain('Console')
    })

    it('emits change-visible on checkbox click', async () => {
        const wrapper = mount(SettingsDashboardSortableItem, {
            props: { name: 'console', visible: true },
        })
        const icons = wrapper.findAll('.v-icon')
        const checkboxIcon = icons[icons.length - 1]
        await checkboxIcon.trigger('click.stop')
        expect(wrapper.emitted('change-visible')![0]).toEqual(['console', false])
    })

    it('emits change-visible with true when currently not visible', async () => {
        const wrapper = mount(SettingsDashboardSortableItem, {
            props: { name: 'webcam', visible: false },
        })
        const icons = wrapper.findAll('.v-icon')
        const checkboxIcon = icons[icons.length - 1]
        await checkboxIcon.trigger('click.stop')
        expect(wrapper.emitted('change-visible')![0]).toEqual(['webcam', true])
    })
})
