import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsMiscellaneousTab from '@/components/settings/SettingsMiscellaneousTab.vue'

const mockRouterReplace = vi.fn()
const mockRouteReactive = vi.hoisted(() => {
    const route = { path: '/settings', query: {}, hash: '' }
    return route
})

vi.mock('vue-router', () => ({
    useRoute: () => mockRouteReactive,
    useRouter: () => ({
        replace: mockRouterReplace,
    }),
}))

vi.mock('@/composables/useMiscellaneous', () => ({
    useMiscellaneous: () => ({}),
}))

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabList.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabList',
        template: '<div class="tab-list-stub">TabList</div>',
        emits: ['open-page'],
    },
}))

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroups.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabLightGroups',
        props: ['type', 'name'],
        template: '<div class="tab-light-groups-stub">LightGroups: {{ type }} - {{ name }}</div>',
        emits: ['close'],
    },
}))

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresets.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabLightPresets',
        props: ['type', 'name'],
        template: '<div class="tab-light-presets-stub">LightPresets: {{ type }} - {{ name }}</div>',
        emits: ['close'],
    },
}))

describe('SettingsMiscellaneousTab.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteReactive.query = {}
        mockRouteReactive.path = '/settings'
        mockRouteReactive.hash = ''
        mockRouterReplace.mockResolvedValue(undefined)
    })

    it('renders the list view by default (no page query)', () => {
        const wrapper = mount(SettingsMiscellaneousTab, {
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        expect(wrapper.find('.tab-list-stub').exists()).toBe(true)
        expect(wrapper.find('.tab-light-groups-stub').exists()).toBe(false)
        expect(wrapper.find('.tab-light-presets-stub').exists()).toBe(false)
    })

    it('renders without crashing with groups query', () => {
        mockRouteReactive.query = { miscPage: 'groups', miscType: 'neopixel', miscName: 'my_strip' }
        const wrapper = mount(SettingsMiscellaneousTab, {
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        // Component should mount without error
        expect(wrapper.exists()).toBe(true)
    })

    it('renders without crashing with presets query', () => {
        mockRouteReactive.query = { miscPage: 'presets', miscType: 'led', miscName: 'my_led' }
        const wrapper = mount(SettingsMiscellaneousTab, {
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders list view by default', () => {
        const wrapper = mount(SettingsMiscellaneousTab, {
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        expect(wrapper.text()).toContain('TabList')
    })

    it('renders child stubs properly when list is active', () => {
        const wrapper = mount(SettingsMiscellaneousTab, {
            global: {
                plugins: [createStore({ state: {} })],
            },
        })
        expect(wrapper.find('.tab-list-stub').exists()).toBe(true)
    })
})
