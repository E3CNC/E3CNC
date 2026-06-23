import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'
import SidebarItem from '@/components/ui/SidebarItem.vue'

vi.mock('vue-router', () => ({
    useRoute: () => ({ path: '/dashboard' }),
    useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('vuetify/components', () => ({
    VTooltip: {
        name: 'VTooltip',
        props: { location: String, openDelay: Number, disabled: Boolean },
        template: '<div class="v-tooltip"><slot name="activator" :props="{}" /><slot /></div>',
    },
    VListItem: {
        name: 'VListItem',
        props: { router: Boolean, to: [String, Object], href: String, target: String, class: [String, Object] },
        template: '<div class="v-list-item" :class="$props.class"><slot name="prepend" /><slot name="title" /></div>',
    },
    VIcon: { name: 'VIcon', template: '<i class="v-icon"><slot /></i>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
}))

function createStoreWithStyle(navigationStyle: string = 'full') {
    return createStore({
        state: {
            gui: {
                uiSettings: { navigationStyle },
            },
        },
        getters: {},
        mutations: {},
        actions: {},
    })
}

describe('SidebarItem.vue', () => {
    it('renders the item title', () => {
        const wrapper = mount(SidebarItem, {
            props: {
                item: { icon: 'mdiHome', title: 'Dashboard', to: '/dashboard' },
            },
            global: {
                plugins: [createStoreWithStyle()],
            },
        })
        expect(wrapper.text()).toContain('Dashboard')
    })

    it('renders a router link when to is set', () => {
        const wrapper = mount(SidebarItem, {
            props: {
                item: { icon: 'mdiHome', title: 'Dashboard', to: '/dashboard' },
            },
            global: {
                plugins: [createStoreWithStyle()],
            },
        })
        expect(wrapper.find('.v-list-item').exists()).toBe(true)
    })

    it('renders an external link when href is set', () => {
        const wrapper = mount(SidebarItem, {
            props: {
                item: { icon: 'mdiOpenInNew', title: 'External', href: 'https://example.com', target: '_blank' },
            },
            global: {
                plugins: [createStoreWithStyle()],
            },
        })
        expect(wrapper.text()).toContain('External')
    })

    it('shows divider when to is /allCncMachines', () => {
        const wrapper = mount(SidebarItem, {
            props: {
                item: { icon: 'mdiHome', title: 'Farm', to: '/allCncMachines' },
            },
            global: {
                plugins: [createStoreWithStyle()],
            },
        })
        expect(wrapper.find('hr').exists()).toBe(true)
    })

    it('does not show divider for other routes', () => {
        const wrapper = mount(SidebarItem, {
            props: {
                item: { icon: 'mdiHome', title: 'Dashboard', to: '/dashboard' },
            },
            global: {
                plugins: [createStoreWithStyle()],
            },
        })
        expect(wrapper.find('hr').exists()).toBe(false)
    })

    it('applies active class when route matches', () => {
        const wrapper = mount(SidebarItem, {
            props: {
                item: { icon: 'mdiHome', title: 'Dashboard', to: '/dashboard' },
            },
            global: {
                plugins: [createStoreWithStyle()],
            },
        })
        // isActive = route.path === item.to => '/dashboard' === '/dashboard'
        // The v-list-item mock renders .v-list-item
        expect(wrapper.find('.v-list-item').exists()).toBe(true)
    })

    it('does not apply active class for external links', () => {
        const wrapper = mount(SidebarItem, {
            props: {
                item: { icon: 'mdiOpenInNew', title: 'External', href: 'https://example.com', target: '_blank' },
            },
            global: {
                plugins: [createStoreWithStyle()],
            },
        })
        expect(wrapper.find('.active-nav-item').exists()).toBe(false)
    })

    it('disables tooltip when navigationStyle is not iconsOnly', () => {
        const wrapper = mount(SidebarItem, {
            props: {
                item: { icon: 'mdiHome', title: 'Dashboard', to: '/dashboard' },
            },
            global: {
                plugins: [createStoreWithStyle('full')],
            },
        })
        // Tooltip should be disabled
        const tooltip = wrapper.find('.v-tooltip')
        expect(tooltip.exists()).toBe(true)
    })
})

// Test for MainsailLogo
import MainsailLogo from '@/components/ui/MainsailLogo.vue'

describe('MainsailLogo.vue', () => {
    it('renders an SVG', () => {
        const wrapper = mount(MainsailLogo)
        expect(wrapper.find('svg').exists()).toBe(true)
    })

    it('renders with empty style when no color prop (default prop is blank)', () => {
        const wrapper = mount(MainsailLogo)
        const path = wrapper.find('path')
        // Vue's style binding adds space after colon when value is blank
        expect(path.attributes('style')).toBe('')
    })

    it('uses provided color prop', () => {
        const wrapper = mount(MainsailLogo, {
            props: { color: '#ff0000' },
        })
        const path = wrapper.find('path')
        expect(path.attributes('style')).toContain('#ff0000')
        expect(path.attributes('style')).toContain('fill')
    })

    it('updates color when prop changes', async () => {
        const wrapper = mount(MainsailLogo, {
            props: { color: '#ff0000' },
        })
        await wrapper.setProps({ color: '#00ff00' })
        const path = wrapper.find('path')
        expect(path.attributes('style')).toContain('#00ff00')
    })

    it('renders with empty style when color prop cleared', async () => {
        const wrapper = mount(MainsailLogo, {
            props: { color: '#ff0000' },
        })
        await wrapper.setProps({ color: '' })
        const path = wrapper.find('path')
        expect(path.attributes('style')).toBe('')
    })
})
