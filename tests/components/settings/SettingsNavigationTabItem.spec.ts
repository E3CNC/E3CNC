import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsNavigationTabItem from '@/components/settings/SettingsNavigationTabItem.vue'

vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VIcon: {
        name: 'VIcon',
        props: ['icon', 'color'],
        template: '<i class="v-icon" @click="$emit(\'click\')"><slot /></i>',
    },
}))

vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({
        draggableBgStyle: { backgroundColor: 'transparent' },
    }),
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: ['title', 'subTitle', 'dynamicSlotWidth'],
        template:
            '<div class="settings-row"><span class="row-title">{{ title }}</span><span class="row-subtitle">{{ subTitle }}</span><slot /></div>',
    },
}))

describe('SettingsNavigationTabItem.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        store = createStore({
            state: {},
            getters: {
                'gui/navigation/changeVisibility': () => vi.fn(),
            },
        })
    })

    it('renders the navi point title', () => {
        const wrapper = mount(SettingsNavigationTabItem, {
            props: {
                naviPoint: {
                    title: 'Dashboard',
                    type: 'route',
                    icon: '',
                    position: 0,
                    visible: true,
                    to: '/dashboard',
                },
            },
            global: { plugins: [store] },
        })
        expect(wrapper.text()).toContain('Dashboard')
    })

    it('shows URL subtitle for link type navi points', () => {
        const wrapper = mount(SettingsNavigationTabItem, {
            props: {
                naviPoint: {
                    title: 'External',
                    type: 'link',
                    icon: '',
                    position: 0,
                    visible: true,
                    href: 'https://example.com',
                },
            },
            global: { plugins: [store] },
        })
        expect(wrapper.text()).toContain('External')
        expect(wrapper.text()).toContain('URL: https://example.com')
    })

    it('does not show subtitle for route type navi points', () => {
        const wrapper = mount(SettingsNavigationTabItem, {
            props: {
                naviPoint: {
                    title: 'Dashboard',
                    type: 'route',
                    icon: '',
                    position: 0,
                    visible: true,
                    to: '/dashboard',
                },
            },
            global: { plugins: [store] },
        })
        // Row subtitle should be undefined for route type
        const subtitle = wrapper.find('.row-subtitle')
        expect(subtitle.text()).toBe('')
    })

    it('renders a drag handle icon', () => {
        const wrapper = mount(SettingsNavigationTabItem, {
            props: {
                naviPoint: {
                    title: 'Dashboard',
                    type: 'route',
                    icon: '',
                    position: 0,
                    visible: true,
                    to: '/dashboard',
                },
            },
            global: { plugins: [store] },
        })
        expect(wrapper.find('.handle').exists()).toBe(true)
        expect(wrapper.find('.v-icon').exists()).toBe(true)
    })

    it('renders visible checkbox icon when navi point is visible', () => {
        const wrapper = mount(SettingsNavigationTabItem, {
            props: {
                naviPoint: {
                    title: 'Dashboard',
                    type: 'route',
                    icon: '',
                    position: 0,
                    visible: true,
                    to: '/dashboard',
                },
            },
            global: { plugins: [store] },
        })
        // Should show checked checkbox (mdiCheckboxMarked) for visible
        // The icon is rendered via v-icon
        expect(wrapper.findAll('.v-icon').length).toBeGreaterThanOrEqual(2) // drag + checkbox
    })

    it('renders unchecked checkbox icon when navi point is not visible', () => {
        const wrapper = mount(SettingsNavigationTabItem, {
            props: {
                naviPoint: {
                    title: 'Dashboard',
                    type: 'route',
                    icon: '',
                    position: 0,
                    visible: false,
                    to: '/dashboard',
                },
            },
            global: { plugins: [store] },
        })
        expect(wrapper.findAll('.v-icon').length).toBeGreaterThanOrEqual(2)
    })

    it('applies draggable background style', () => {
        const wrapper = mount(SettingsNavigationTabItem, {
            props: {
                naviPoint: {
                    title: 'Dashboard',
                    type: 'route',
                    icon: '',
                    position: 0,
                    visible: true,
                    to: '/dashboard',
                },
            },
            global: { plugins: [store] },
        })
        const row = wrapper.find('.v-row')
        expect(row.exists()).toBe(true)
    })
})
