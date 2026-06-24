import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import Sortable from '@/components/settings/Dashboard/Sortable.vue'

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', template: '<div class="v-card"><slot /></div>' },
    VList: { name: 'VList', template: '<div class="v-list"><slot /></div>' },
    VListItem: { name: 'VListItem', props: ['title'], template: '<div class="v-list-item"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VIcon: { name: 'VIcon', props: ['icon'], template: '<i class="v-icon"><slot /></i>' },
}))

vi.mock('@/composables/useDashboard', () => ({
    useDashboard: () => ({}),
}))

vi.mock('vuedraggable', () => ({
    default: {
        name: 'draggable',
        props: ['modelValue', 'handle', 'group', 'itemKey'],
        template: '<div class="draggable-stub"><slot name="item" v-for="item in modelValue" :element="item" /></div>',
    },
}))

vi.mock('@/components/settings/Dashboard/SortableItem.vue', () => ({
    default: {
        name: 'SettingsDashboardSortableItem',
        props: ['name', 'visible'],
        template: '<div class="sortable-item-stub">{{ name }} ({{ visible }})</div>',
        emits: ['change-visible'],
    },
}))

describe('Sortable.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        store = createStore({
            state: {
                gui: {
                    dashboard: {
                        floatingPanels: {},
                    },
                },
            },
            getters: {
                'gui/getPanels': () => () => [
                    { name: 'Panel1', visible: true },
                    { name: 'Panel2', visible: false },
                ],
                'gui/getPanelExpand': () => () => true,
            },
        })
    })

    it('renders without crashing', () => {
        const wrapper = mount(Sortable, {
            props: { viewportName: 'desktop', column: 1 },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders a v-card', () => {
        const wrapper = mount(Sortable, {
            props: { viewportName: 'desktop', column: 1 },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-card').exists()).toBe(true)
    })

    it('renders v-list', () => {
        const wrapper = mount(Sortable, {
            props: { viewportName: 'desktop', column: 1 },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-list').exists()).toBe(true)
    })

    it('does not show info row when column >= 2', () => {
        const wrapper = mount(Sortable, {
            props: { viewportName: 'desktop', column: 2 },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).not.toContain('Panels.StatusPanel.Headline')
    })

    it('renders sortable items via draggable component', () => {
        const wrapper = mount(Sortable, {
            props: { viewportName: 'desktop', column: 1 },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const draggable = wrapper.find('.draggable-stub')
        expect(draggable.exists()).toBe(true)
    })

    it('renders SettingsDashboardSortableItem for each panel in layout', () => {
        const wrapper = mount(Sortable, {
            props: { viewportName: 'desktop', column: 1 },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const items = wrapper.findAllComponents({ name: 'SettingsDashboardSortableItem' })
        expect(items.length).toBe(2)
        expect(items[0].props('name')).toBe('Panel1')
        expect(items[1].props('name')).toBe('Panel2')
    })
})
