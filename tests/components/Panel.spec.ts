import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import Panel from '@/components/ui/Panel.vue'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        viewport: { value: 'desktop' },
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div :class="$attrs.class" :style="$attrs.style"><slot /></div>' },
    VToolbar: { name: 'VToolbar', inheritAttrs: false, template: '<div :class="$attrs.class" :style="$attrs.style"><slot /></div>' },
    VToolbarTitle: { name: 'VToolbarTitle', template: '<span><slot /></span>' },
    VToolbarItems: { name: 'VToolbarItems', template: '<div><slot /></div>' },
    VIcon: { name: 'VIcon', props: ['start', 'icon'], template: '<i><slot /></i>' },
    VBtn: { name: 'VBtn', props: ['icon', 'ripple'], template: '<button><slot /></button>' },
    VSpacer: { name: 'VSpacer', template: '<span style="flex:1" />' },
    VExpandTransition: { name: 'VExpandTransition', template: '<div><slot /></div>' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: false, initializationList: [], loadings: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: [] },
            printer: {
                print_stats: { state: 'ready' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
            },
            gui: {
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                    ...(overrides.dashboard || {}),
                },
                general: { printername: 'Test' },
                control: {},
                uiSettings: {},
                navigationSettings: { entries: [] },
            },
            files: {},
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'gui/getPanelExpand': (state: any) => () => true,
            ...(overrides.getters || {}),
        },
    })
}

describe('Panel.vue - floating behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders title', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Temperature', icon: 'mdi-thermometer', cardClass: 'temperature', toolbarColor: 'primary' },
            global: { plugins: [store] },
        })

        expect(wrapper.text()).toContain('Temperature')
    })

    it('hides toolbar-items when floatable=false, collapsible=false, and no buttons slot', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test' },
            global: { plugins: [store] },
        })

        const toolbarItems = wrapper.findComponent({ name: 'v-toolbar-items' })
        expect(toolbarItems.attributes('style')).toContain('display: none')
    })

    it('shows close button and resize handle when floating', () => {
        const store = createStoreWithState({
            dashboard: {
                floatingPanels: {
                    'test-panel': { x: 100, y: 200, width: 400, height: 300, zIndex: 5 },
                },
            },
        })
        const wrapper = mount(Panel, {
            props: { title: 'Floating Panel', cardClass: 'test-panel', floatable: true },
            global: { plugins: [store] },
        })

        expect(wrapper.findComponent({ name: 'v-btn' }).exists()).toBe(true)
        expect(wrapper.find('.resize-handle').exists()).toBe(true)
    })

    it('applies floating CSS class when panel is floating', () => {
        const store = createStoreWithState({
            dashboard: {
                floatingPanels: {
                    'test-panel': { x: 100, y: 200, width: 400, height: 300, zIndex: 5 },
                },
            },
        })
        const wrapper = mount(Panel, {
            props: { title: 'Floating Panel', cardClass: 'test-panel', floatable: true },
            global: { plugins: [store] },
        })

        const card = wrapper.findComponent({ name: 'v-card' })
        expect(card.classes()).toContain('floating')
    })

    it('sets position and z-index inline style when floating', () => {
        const store = createStoreWithState({
            dashboard: {
                floatingPanels: {
                    'test-panel': { x: 150, y: 250, width: 500, height: 350, zIndex: 42 },
                },
            },
        })
        const wrapper = mount(Panel, {
            props: { title: 'Floating Panel', cardClass: 'test-panel', floatable: true },
            global: { plugins: [store] },
        })

        const card = wrapper.findComponent({ name: 'v-card' })
        const style = card.attributes('style')
        expect(style).toContain('left: 150px')
        expect(style).toContain('top: 250px')
        expect(style).toContain('width: 500px')
        expect(style).toContain('height: 350px')
        expect(style).toContain('z-index: 42')
    })

    it('does not apply floating features when floatable=true but panel is not in floatingPanels', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Docked Panel', cardClass: 'test-panel', floatable: true },
            global: { plugins: [store] },
        })

        const card = wrapper.findComponent({ name: 'v-card' })
        expect(card.classes()).not.toContain('floating')
        expect(wrapper.find('.resize-handle').exists()).toBe(false)
    })

    it('sets style with position fixed when floating', () => {
        const store = createStoreWithState({
            dashboard: {
                floatingPanels: {
                    'test-panel': { x: 100, y: 200, width: 400, height: 300, zIndex: 5 },
                },
            },
        })
        const wrapper = mount(Panel, {
            props: { title: 'Floating Panel', cardClass: 'test-panel', floatable: true },
            global: { plugins: [store] },
        })

        const card = wrapper.findComponent({ name: 'v-card' })
        expect(card.attributes('style')).toContain('position: fixed')
    })

    it('removes margin-bottom class when floating', () => {
        const store = createStoreWithState({
            dashboard: {
                floatingPanels: {
                    'test-panel': { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
                },
            },
        })
        const wrapper = mount(Panel, {
            props: { title: 'Floating Panel', cardClass: 'test-panel', floatable: true, marginBottom: true },
            global: { plugins: [store] },
        })

        const card = wrapper.findComponent({ name: 'v-card' })
        expect(card.classes()).not.toContain('mb-3')
    })

    it('adds is-floatable class to toolbar when floatable=true', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', floatable: true },
            global: { plugins: [store] },
        })

        const toolbar = wrapper.findComponent({ name: 'v-toolbar' })
        expect(toolbar.classes()).toContain('is-floatable')
    })

    it('sets spacer height to 0 when not floating and no animation', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', floatable: true },
            global: { plugins: [store] },
        })

        const wrapperDiv = wrapper.find('.panel-wrapper')
        const style = wrapperDiv.attributes('style')
        expect(style).toBeUndefined()
    })
})
