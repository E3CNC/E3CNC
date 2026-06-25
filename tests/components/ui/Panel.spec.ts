import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createTestVuetify } from '../../vuetify.ts'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ viewport: { value: 'desktop' } }),
}))

vi.mock('@/store/variables', () => ({ panelToolbarHeight: 48 }))

vi.mock('@mdi/js', () => ({ mdiChevronDown: 'mdiChevronDown', mdiClose: 'mdiClose' }))

import Panel from '@/components/ui/Panel.vue'

const vuetify = createTestVuetify()

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
    it('renders with title and icon', () => {
        const wrapper = mount(Panel, {
            props: { title: 'Test Panel', icon: 'mdiTest', cardClass: 'test-panel' },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
        expect(wrapper.text()).toContain('Test Panel')
    })

    it('renders without title when not provided', () => {
        const wrapper = mount(Panel, {
            props: { cardClass: 'test-panel' },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('shows collapse button when collapsible', () => {
        const wrapper = mount(Panel, {
            props: { cardClass: 'test-panel', collapsible: true, title: 'Collapsible' },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders slot content', () => {
        const wrapper = mount(Panel, {
            props: { cardClass: 'test-panel', title: 'Slot Test' },
            slots: { default: '<div class="slot-content">Content</div>' },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.text()).toContain('Content')
    })

    it('renders buttons slot', () => {
        const wrapper = mount(Panel, {
            props: { cardClass: 'test-panel' },
            slots: { buttons: '<button class="btn-slot">Action</button>' },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.find('.btn-slot').exists()).toBe(true)
    })

    it('renders buttons-left slot', () => {
        const wrapper = mount(Panel, {
            props: { cardClass: 'test-panel' },
            slots: { 'buttons-left': '<span class="left-slot">Left</span>' },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.find('.left-slot').exists()).toBe(true)
    })

    it('applies marginBottom class when marginBottom is true', () => {
        const wrapper = mount(Panel, {
            props: { cardClass: 'test-panel', marginBottom: true, title: 'MB' },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('applies loading prop', () => {
        const wrapper = mount(Panel, {
            props: { cardClass: 'test-panel', title: 'Loading Test', loading: true },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('applies height prop', () => {
        const wrapper = mount(Panel, {
            props: { cardClass: 'test-panel', height: 200 },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('applies toolbarClass and collapsible class', () => {
        const wrapper = mount(Panel, {
            props: { cardClass: 'test-panel', toolbarClass: 'custom-toolbar', collapsible: true },
            global: { plugins: [vuetify, makeStore()] },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })
})
