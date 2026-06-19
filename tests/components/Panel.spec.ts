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
    VCard: {
        name: 'VCard',
        inheritAttrs: false,
        template: '<div :class="$attrs.class" :style="$attrs.style"><slot /></div>',
    },
    VToolbar: {
        name: 'VToolbar',
        inheritAttrs: false,
        template: '<div :class="$attrs.class" :style="$attrs.style"><slot /></div>',
    },
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

// ──────────────────────────────────────────────────────────────
// NEW TESTS: Expanded coverage for Panel.vue code paths
// ──────────────────────────────────────────────────────────────

/**
 * Helper to create a store that tracks expand/collapse state reactively
 * via Vuex state (needed so the computed `expand` getter re-evaluates).
 */
function createExpandTrackingStore(initialExpand: boolean = true) {
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
                    /** Tracked here so Vuex reactivity picks up changes. */
                    _expandState: {} as Record<string, boolean>,
                },
                general: { printername: 'Test' },
                control: {},
                uiSettings: {},
                navigationSettings: { entries: [] },
            },
            files: {},
            instancesDB: 'moonraker',
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'gui/getPanelExpand': (state: any) => (cardClass: string, viewport: string) => {
                const key = `${cardClass}-${viewport}`
                if (!(key in state.gui.dashboard._expandState)) {
                    state.gui.dashboard._expandState[key] = initialExpand
                }
                return state.gui.dashboard._expandState[key]
            },
        },
        mutations: {
            'gui/saveExpandPanel': (state: any, payload: { name: string; value: boolean; viewport: string }) => {
                const key = `${payload.name}-${payload.viewport}`
                state.gui.dashboard._expandState[key] = payload.value
            },
        },
        actions: {
            'gui/saveExpandPanel': ({ commit }: any, payload: any) => {
                commit('gui/saveExpandPanel', payload)
            },
        },
    })
}

describe('Panel.vue - collapsible behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders collapse toggle button when collapsible=true', () => {
        const store = createExpandTrackingStore(true)
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: true },
            global: { plugins: [store] },
        })

        const btn = wrapper.find('.btn-collapsible')
        expect(btn.exists()).toBe(true)
    })

    it('does not render collapse toggle button when collapsible=false', () => {
        const store = createExpandTrackingStore(true)
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: false },
            global: { plugins: [store] },
        })

        expect(wrapper.find('.btn-collapsible').exists()).toBe(false)
    })

    it('shows panel-content when collapsible=true and expand=true', () => {
        const store = createExpandTrackingStore(true)
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: true },
            global: { plugins: [store] },
        })

        const content = wrapper.find('.panel-content')
        // v-show is true → no display:none
        expect(content.attributes('style') ?? '').not.toContain('display: none')
    })

    it('hides panel-content when collapsible=true and expand=false', () => {
        const store = createExpandTrackingStore(false)
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: true },
            global: { plugins: [store] },
        })

        const content = wrapper.find('.panel-content')
        expect(content.attributes('style')).toContain('display: none')
    })

    it('shows panel-content when collapsible=false even if expand=false', () => {
        const store = createExpandTrackingStore(false)
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: false },
            global: { plugins: [store] },
        })

        const content = wrapper.find('.panel-content')
        expect(content.attributes('style') ?? '').not.toContain('display: none')
    })

    it('toggles expand state when collapsible button is clicked', async () => {
        const store = createExpandTrackingStore(true)
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: true },
            global: { plugins: [store] },
        })

        // Initially expanded → content visible (no style or no display:none)
        let content = wrapper.find('.panel-content')
        expect(content.attributes('style') ?? '').not.toContain('display: none')

        // Click collapse button
        const btn = wrapper.find('.btn-collapsible')
        await btn.trigger('click')
        await wrapper.vm.$nextTick()

        // Now collapsed → content hidden
        content = wrapper.find('.panel-content')
        expect(content.attributes('style') ?? '').toContain('display: none')

        // Click again to expand
        await btn.trigger('click')
        await wrapper.vm.$nextTick()

        content = wrapper.find('.panel-content')
        expect(content.attributes('style') ?? '').not.toContain('display: none')
    })

    it('applies icon-rotate-90 class on the collapse icon when collapsed', async () => {
        const store = createExpandTrackingStore(true)
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: true },
            global: { plugins: [store] },
        })

        // Initially expanded → icon-rotate-90 not present
        expect(wrapper.find('.icon-rotate-90').exists()).toBe(false)

        // Collapse
        await wrapper.find('.btn-collapsible').trigger('click')
        await wrapper.vm.$nextTick()

        // Now collapsed → icon-rotate-90 present
        expect(wrapper.find('.icon-rotate-90').exists()).toBe(true)
    })
})

describe('Panel.vue - slot rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders buttons-left slot content', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel' },
            global: { plugins: [store] },
            slots: { 'buttons-left': '<button class="btn-left-test">LEFT</button>' },
        })

        expect(wrapper.find('.btn-left-test').exists()).toBe(true)
        expect(wrapper.find('.btn-left-test').text()).toBe('LEFT')
    })

    it('renders buttons-title slot content', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel' },
            global: { plugins: [store] },
            slots: { 'buttons-title': '<span class="btn-title-test">TITLE</span>' },
        })

        expect(wrapper.find('.btn-title-test').exists()).toBe(true)
        expect(wrapper.find('.btn-title-test').text()).toBe('TITLE')
    })
})

describe('Panel.vue - icon rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders v-icon when icon prop is provided and no icon slot', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', icon: 'mdi-test' },
            global: { plugins: [store] },
        })

        const icon = wrapper.findComponent({ name: 'v-icon' })
        expect(icon.exists()).toBe(true)
        // The icon value is rendered as slot content via {{ icon }}
        expect(icon.text()).toBe('mdi-test')
    })

    it('does not render v-icon when icon prop is null', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', icon: undefined },
            global: { plugins: [store] },
        })

        expect(wrapper.findComponent({ name: 'v-icon' }).exists()).toBe(false)
    })

    it('renders icon slot content instead of v-icon when icon slot is provided', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', icon: 'mdi-thermometer' },
            global: { plugins: [store] },
            slots: { icon: '<span class="custom-icon-slot">CUSTOM</span>' },
        })

        // v-icon should NOT render because icon slot takes precedence
        expect(wrapper.findComponent({ name: 'v-icon' }).exists()).toBe(false)
        // Slot content should be rendered
        expect(wrapper.find('.custom-icon-slot').exists()).toBe(true)
        expect(wrapper.find('.custom-icon-slot').text()).toBe('CUSTOM')
    })
})

describe('Panel.vue - height prop', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('applies height style as px when height prop is a number', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', height: 500 },
            global: { plugins: [store] },
        })

        const card = wrapper.findComponent({ name: 'v-card' })
        const style = card.attributes('style')
        expect(style).toContain('height: 500px')
        expect(style).toContain('max-height: 500px')
        expect(style).toContain('display: flex')
    })

    it('applies height style as-is when height prop is a string', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', height: '75vh' },
            global: { plugins: [store] },
        })

        const card = wrapper.findComponent({ name: 'v-card' })
        const style = card.attributes('style')
        expect(style).toContain('height: 75vh')
        expect(style).toContain('max-height: 75vh')
    })

    it('does not apply height style when height prop is null', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', height: undefined },
            global: { plugins: [store] },
        })

        const card = wrapper.findComponent({ name: 'v-card' })
        const style = card.attributes('style')
        // height should not be present
        expect(style ?? '').not.toContain('height')
    })

    it('does not apply height style when height prop is not set', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel' },
            global: { plugins: [store] },
        })

        const card = wrapper.findComponent({ name: 'v-card' })
        const style = card.attributes('style')
        expect(style ?? '').not.toContain('height')
    })
})

describe('Panel.vue - loading state', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('mounts without error when loading=true', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', loading: true },
            global: { plugins: [store] },
        })

        // Component renders toolbar and slots
        expect(wrapper.findComponent({ name: 'v-toolbar' }).exists()).toBe(true)
        expect(wrapper.find('.panel-content').exists()).toBe(true)
    })

    it('mounts without error when loading=false', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', loading: false },
            global: { plugins: [store] },
        })

        expect(wrapper.findComponent({ name: 'v-toolbar' }).exists()).toBe(true)
    })
})

describe('Panel.vue - hideButtonsOnCollapse', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('hides buttons slot when collapsed and hideButtonsOnCollapse is true', () => {
        const store = createExpandTrackingStore(false)
        const wrapper = mount(Panel, {
            props: {
                title: 'Test',
                cardClass: 'test-panel',
                collapsible: true,
                hideButtonsOnCollapse: true,
            },
            global: { plugins: [store] },
            slots: { buttons: '<button class="btn-test-action">ACTION</button>' },
        })

        // The outer toolbar-items should be visible (hasButtonsSlot is true)
        const toolbarItems = wrapper.findComponent({ name: 'v-toolbar-items' })
        expect(toolbarItems.attributes('style') ?? '').not.toContain('display: none')

        // But the inner div with slot should NOT be rendered (v-if is false)
        expect(wrapper.find('.btn-test-action').exists()).toBe(false)
    })

    it('shows buttons slot when collapsed but hideButtonsOnCollapse is false', () => {
        const store = createExpandTrackingStore(false)
        const wrapper = mount(Panel, {
            props: {
                title: 'Test',
                cardClass: 'test-panel',
                collapsible: true,
                hideButtonsOnCollapse: false,
            },
            global: { plugins: [store] },
            slots: { buttons: '<button class="btn-test-action">ACTION</button>' },
        })

        // Content should be rendered because hideButtonsOnCollapse is false
        expect(wrapper.find('.btn-test-action').exists()).toBe(true)
    })

    it('shows buttons slot when expanded even with hideButtonsOnCollapse=true', () => {
        const store = createExpandTrackingStore(true)
        const wrapper = mount(Panel, {
            props: {
                title: 'Test',
                cardClass: 'test-panel',
                collapsible: true,
                hideButtonsOnCollapse: true,
            },
            global: { plugins: [store] },
            slots: { buttons: '<button class="btn-test-action">ACTION</button>' },
        })

        // Expanded → buttons visible despite hideButtonsOnCollapse
        expect(wrapper.find('.btn-test-action').exists()).toBe(true)
    })
})

describe('Panel.vue - getToolbarClass and toolbarClass prop', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('applies toolbarClass prop to toolbar element', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', toolbarClass: 'my-custom-class' },
            global: { plugins: [store] },
        })

        const toolbar = wrapper.findComponent({ name: 'v-toolbar' })
        expect(toolbar.classes()).toContain('my-custom-class')
    })

    it('adds collapsible class when collapsible=true', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: true },
            global: { plugins: [store] },
        })

        const toolbar = wrapper.findComponent({ name: 'v-toolbar' })
        expect(toolbar.classes()).toContain('collapsible')
    })

    it('does not add collapsible class when collapsible=false', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: false },
            global: { plugins: [store] },
        })

        const toolbar = wrapper.findComponent({ name: 'v-toolbar' })
        expect(toolbar.classes()).not.toContain('collapsible')
    })

    it('adds is-floatable class when floatable=true', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', floatable: true },
            global: { plugins: [store] },
        })

        const toolbar = wrapper.findComponent({ name: 'v-toolbar' })
        expect(toolbar.classes()).toContain('is-floatable')
    })

    it('combines toolbarClass, collapsible, and floatable in getToolbarClass', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: {
                title: 'Test',
                cardClass: 'test-panel',
                toolbarClass: 'custom',
                collapsible: true,
                floatable: true,
            },
            global: { plugins: [store] },
        })

        const toolbar = wrapper.findComponent({ name: 'v-toolbar' })
        const classes = toolbar.classes()
        expect(classes).toContain('custom')
        expect(classes).toContain('collapsible')
        expect(classes).toContain('is-floatable')
    })
})

describe('Panel.vue - hasButtonsSlot detection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows toolbar-items when buttons slot is provided', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: false, floatable: false },
            global: { plugins: [store] },
            slots: { buttons: '<button>ACTION</button>' },
        })

        const toolbarItems = wrapper.findComponent({ name: 'v-toolbar-items' })
        expect(toolbarItems.attributes('style') ?? '').not.toContain('display: none')
    })

    it('shows toolbar-items when collapsible is true even without buttons slot', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', collapsible: true },
            global: { plugins: [store] },
            // No buttons slot
        })

        const toolbarItems = wrapper.findComponent({ name: 'v-toolbar-items' })
        expect(toolbarItems.attributes('style') ?? '').not.toContain('display: none')
    })

    it('shows toolbar-items when floatable is true and panel is actually floating', () => {
        const store = createStoreWithState({
            dashboard: {
                floatingPanels: {
                    'test-panel': { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
                },
            },
        })
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel', floatable: true },
            global: { plugins: [store] },
            // No buttons slot, no collapsible — floating alone is enough
        })

        const toolbarItems = wrapper.findComponent({ name: 'v-toolbar-items' })
        expect(toolbarItems.attributes('style') ?? '').not.toContain('display: none')
    })

    it('hides toolbar-items when no buttons slot, not collapsible, not floating', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Test', cardClass: 'test-panel' },
            global: { plugins: [store] },
        })

        const toolbarItems = wrapper.findComponent({ name: 'v-toolbar-items' })
        expect(toolbarItems.attributes('style')).toContain('display: none')
    })
})

describe('Panel.vue - title rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders a string title', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: 'Temperature', cardClass: 'test-panel' },
            global: { plugins: [store] },
        })

        expect(wrapper.text()).toContain('Temperature')
    })

    it('renders an object title as its JSON representation', () => {
        const store = createStoreWithState()
        // title accepts String|Object. In Vue 3 the {{ }} interpolation
        // serialises objects as JSON (not "[object Object]").
        const wrapper = mount(Panel, {
            props: { title: { key: 'translation-key' } as any, cardClass: 'test-panel' },
            global: { plugins: [store] },
        })

        expect(wrapper.text()).toContain('translation-key')
    })

    it('does not render a subheading span when title is empty string', () => {
        const store = createStoreWithState()
        const wrapper = mount(Panel, {
            props: { title: '', cardClass: 'test-panel' },
            global: { plugins: [store] },
        })

        // v-if="title" is falsy for '' so the <span class="subheading"> is absent
        expect(wrapper.find('.subheading').exists()).toBe(false)
    })
})
