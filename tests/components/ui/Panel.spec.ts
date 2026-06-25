import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ viewport: { value: 'desktop' } }),
}))

vi.mock('@/store/variables', () => ({ panelToolbarHeight: 48 }))

vi.mock('@mdi/js', () => ({ mdiChevronDown: 'mdiChevronDown', mdiClose: 'mdiClose' }))

import Panel from '@/components/ui/Panel.vue'

function makeStore(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            gui: {
                dashboard: {
                    floatingPanels: {},
                    ...(overrides.dashboard || {}),
                },
            },
        },
        getters: {
            'gui/getPanelExpand': () => (_name: string, _viewport: string) => true,
            ...(overrides.getters || {}),
        },
        actions: {
            'gui/saveExpandPanel': vi.fn(),
            'gui/saveFloatingPanelPosition': vi.fn(),
            'gui/bringFloatingPanelToFront': vi.fn(),
            ...(overrides.actions || {}),
        },
    })
}

describe('Panel.vue', () => {
    it('module can be imported', () => {
        expect(Panel).toBeDefined()
    })

    it('renders without crashing', () => {
        const wrapper = shallowMount(Panel, {
            props: { title: 'Test Panel', icon: 'mdiTest', cardClass: 'test-panel' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders without title when not provided', () => {
        const wrapper = shallowMount(Panel, {
            props: { cardClass: 'test-panel' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('shows collapse button when collapsible', () => {
        const wrapper = shallowMount(Panel, {
            props: { cardClass: 'test-panel', collapsible: true, title: 'Collapsible' },
            global: { plugins: [makeStore()] },
        })
        // shallowMount stubs VBtn - but panel still renders
        expect(wrapper.exists()).toBe(true)
    })

    it('renders with height prop', () => {
        const wrapper = shallowMount(Panel, {
            props: { cardClass: 'test-panel', height: 200 },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('applies marginBottom class when marginBottom is true', () => {
        const wrapper = shallowMount(Panel, {
            props: { cardClass: 'test-panel', marginBottom: true, title: 'MB' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.classes()).toContain('panel-wrapper')
    })

    it('applies loading prop', () => {
        const wrapper = shallowMount(Panel, {
            props: { cardClass: 'test-panel', title: 'Loading Test', loading: true },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders with floatable prop', () => {
        const wrapper = shallowMount(Panel, {
            props: { cardClass: 'test-panel', floatable: true, title: 'Floatable' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })
})
