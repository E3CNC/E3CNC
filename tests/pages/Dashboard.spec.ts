import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'

// --- Mock vue-i18n ---
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

// --- Mock vuetify/components — VRow, VCol as slot wrappers ---
vi.mock('vuetify/components', () => ({
    VRow: {
        name: 'VRow',
        template: '<div class="v-row"><slot /></div>',
    },
    VCol: {
        name: 'VCol',
        template: '<div class="v-col"><slot /></div>',
    },
}))

// --- Mutable dashboard mock: tests can change these before mounting ---
const mockDashboard = vi.hoisted(() => ({
    isMobile: { value: false, __v_isRef: true },
    isTablet: { value: false, __v_isRef: true },
    isDesktop: { value: true, __v_isRef: true },
    isWidescreen: { value: false, __v_isRef: true },
}))

// --- Mock @/composables/useDashboard — closes over the mutable mockDashboard ---
vi.mock('@/composables/useDashboard', () => ({
    useDashboard: () => mockDashboard,
}))

// --- Mock @/composables/useBase ---
vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        socketIsConnected: { value: true, __v_isRef: true },
        hostUrl: { value: new URL('http://localhost:8080'), __v_isRef: true },
        apiUrl: { value: 'http://localhost:8080', __v_isRef: true },
    }),
}))

// --- Mock all panel components imported by Dashboard.vue ---
function createPanelStub(name: string) {
    return {
        default: {
            name,
            template: `<div class="${name}-stub" />`,
        },
    }
}

vi.mock('@/components/panels/Cnc/CncStatusPanel.vue', () => createPanelStub('CncStatusPanel'))
vi.mock('@/components/panels/Cnc/DroPanel.vue', () => createPanelStub('DroPanel'))
vi.mock('@/components/panels/Cnc/JogPanel.vue', () => createPanelStub('JogPanel'))
vi.mock('@/components/panels/Cnc/Wcs.vue', () => createPanelStub('Wcs'))
vi.mock('@/components/panels/Cnc/SpindleCoolantPanel.vue', () => createPanelStub('SpindleCoolantPanel'))
vi.mock('@/components/panels/Cnc/MdiPanel.vue', () => createPanelStub('MdiPanel'))
vi.mock('@/components/panels/KlippyStatePanel.vue', () => createPanelStub('KlippyStatePanel'))
vi.mock('@/components/panels/MinSettingsPanel.vue', () => createPanelStub('MinSettingsPanel'))
vi.mock('@/components/panels/StatusPanel.vue', () => createPanelStub('StatusPanel'))
vi.mock('@/components/panels/LedEffectsPanel.vue', () => createPanelStub('LedEffectsPanel'))
vi.mock('@/components/panels/MachineSettingsPanel.vue', () => createPanelStub('MachineSettingsPanel'))
vi.mock('@/components/panels/MacrogroupPanel.vue', () => createPanelStub('MacrogroupPanel'))
vi.mock('@/components/panels/MacrosPanel.vue', () => createPanelStub('MacrosPanel'))
vi.mock('@/components/panels/MiniconsolePanel.vue', () => createPanelStub('MiniconsolePanel'))
vi.mock('@/components/panels/MiscellaneousPanel.vue', () => createPanelStub('MiscellaneousPanel'))
vi.mock('@/components/panels/TemperaturePanel.vue', () => createPanelStub('TemperaturePanel'))
vi.mock('@/components/panels/WebcamPanel.vue', () => createPanelStub('WebcamPanel'))

// Import AFTER all mocks
import DashboardPage from '@/pages/Dashboard.vue'

/**
 * Helper: reset the mock dashboard to default (desktop mode) state.
 */
function resetDashboardMocks() {
    mockDashboard.isMobile.value = false
    mockDashboard.isTablet.value = false
    mockDashboard.isDesktop.value = true
    mockDashboard.isWidescreen.value = false
}

/**
 * Helper: create a Vuex store with configurable panel layouts.
 *
 * The store getter 'gui/getPanels' mirrors the signature from
 * src/store/gui/getters.ts: (viewport, column, onlyVisible) => GuiStateLayoutoption[]
 *
 * @param layouts - map of layout identifiers to panel arrays
 */
function createStoreWithLayouts(layouts: Record<string, { name: string; visible: boolean }[]> = {}) {
    const defaultLayouts: Record<string, { name: string; visible: boolean }[]> = {
        'desktop|1': [],
        'desktop|2': [],
        'mobile|0': [],
        'tablet|1': [],
        'tablet|2': [],
        'widescreen|1': [],
        'widescreen|2': [],
        'widescreen|3': [],
    }

    const merged = { ...defaultLayouts, ...layouts }

    return createStore({
        state: {
            gui: {
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                },
            },
        },
        getters: {
            'gui/getPanels':
                () =>
                (viewport: string, column: number, _onlyVisible: boolean = false) => {
                    const key = `${viewport}|${column}`
                    return merged[key] ?? []
                },
        },
    })
}

describe('Dashboard.vue', () => {
    beforeEach(() => {
        resetDashboardMocks()
    })

    // ─── Desktop Mode (existing, kept for coverage) ────────────────────────

    it('renders without crashing (desktop mode)', () => {
        const store = createStoreWithLayouts()
        const wrapper = mount(DashboardPage, {
            global: {
                plugins: [store],
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders StatusPanel', () => {
        const store = createStoreWithLayouts()
        const wrapper = mount(DashboardPage, {
            global: {
                plugins: [store],
            },
        })

        // StatusPanel is rendered directly in every layout (outside the v-for)
        expect(wrapper.findComponent({ name: 'StatusPanel' }).exists()).toBe(true)
    })

    it('renders dynamic panels from desktop layout definition', () => {
        const store = createStoreWithLayouts({
            'desktop|1': [
                { name: 'temperature', visible: true },
                { name: 'webcam', visible: true },
            ],
            'desktop|2': [{ name: 'jog', visible: true }],
        })
        const wrapper = mount(DashboardPage, {
            global: {
                plugins: [store],
            },
        })

        // StatusPanel is always present
        expect(wrapper.findComponent({ name: 'StatusPanel' }).exists()).toBe(true)

        // Dynamic panels from desktopLayout1 (v-col-5)
        expect(wrapper.findComponent({ name: 'TemperaturePanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'WebcamPanel' }).exists()).toBe(true)

        // Dynamic panels from desktopLayout2 (v-col-7)
        expect(wrapper.findComponent({ name: 'JogPanel' }).exists()).toBe(true)
    })

    // ─── Mobile Mode ──────────────────────────────────────────────────────

    it('renders panels in mobile mode (single column)', () => {
        mockDashboard.isMobile.value = true
        mockDashboard.isDesktop.value = false

        const store = createStoreWithLayouts({
            'mobile|0': [
                { name: 'temperature', visible: true },
                { name: 'webcam', visible: true },
                { name: 'dro', visible: true },
            ],
        })
        const wrapper = mount(DashboardPage, {
            global: {
                plugins: [store],
            },
        })

        // StatusPanel is present
        expect(wrapper.findComponent({ name: 'StatusPanel' }).exists()).toBe(true)

        // All mobileLayout panels are rendered
        expect(wrapper.findComponent({ name: 'TemperaturePanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'WebcamPanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'DroPanel' }).exists()).toBe(true)

        // Desktop-specific panels should NOT render in mobile mode
        expect(wrapper.findComponent({ name: 'JogPanel' }).exists()).toBe(false)
    })

    // ─── Tablet Mode ──────────────────────────────────────────────────────

    it('renders panels in tablet mode (two columns)', () => {
        mockDashboard.isTablet.value = true
        mockDashboard.isDesktop.value = false

        const store = createStoreWithLayouts({
            'tablet|1': [
                { name: 'temperature', visible: true },
                { name: 'jog', visible: true },
            ],
            'tablet|2': [
                { name: 'webcam', visible: true },
                { name: 'dro', visible: true },
                { name: 'mdi', visible: true },
            ],
        })
        const wrapper = mount(DashboardPage, {
            global: {
                plugins: [store],
            },
        })

        // StatusPanel is present in the first column
        expect(wrapper.findComponent({ name: 'StatusPanel' }).exists()).toBe(true)

        // tabletLayout1 panels
        expect(wrapper.findComponent({ name: 'TemperaturePanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'JogPanel' }).exists()).toBe(true)

        // tabletLayout2 panels
        expect(wrapper.findComponent({ name: 'WebcamPanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'DroPanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'MdiPanel' }).exists()).toBe(true)
    })

    // ─── Widescreen Mode ──────────────────────────────────────────────────

    it('renders panels in widescreen mode (three columns)', () => {
        mockDashboard.isWidescreen.value = true
        mockDashboard.isDesktop.value = false

        const store = createStoreWithLayouts({
            'widescreen|1': [
                { name: 'temperature', visible: true },
                { name: 'minsettings', visible: true },
            ],
            'widescreen|2': [
                { name: 'jog', visible: true },
                { name: 'dro', visible: true },
            ],
            'widescreen|3': [
                { name: 'webcam', visible: true },
                { name: 'mdi', visible: true },
                { name: 'macros', visible: true },
            ],
        })
        const wrapper = mount(DashboardPage, {
            global: {
                plugins: [store],
            },
        })

        // StatusPanel is present in the first column
        expect(wrapper.findComponent({ name: 'StatusPanel' }).exists()).toBe(true)

        // widescreenLayout1 panels (v-col-3)
        expect(wrapper.findComponent({ name: 'TemperaturePanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'MinSettingsPanel' }).exists()).toBe(true)

        // widescreenLayout2 panels (v-col-5)
        expect(wrapper.findComponent({ name: 'JogPanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'DroPanel' }).exists()).toBe(true)

        // widescreenLayout3 panels (v-col-4)
        expect(wrapper.findComponent({ name: 'WebcamPanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'MdiPanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'MacrosPanel' }).exists()).toBe(true)
    })

    // ─── Unknown Panel Name (isPanelKnown branch) ─────────────────────────

    it('filters out unknown panel names (isPanelKnown returns false)', () => {
        mockDashboard.isMobile.value = true
        mockDashboard.isDesktop.value = false

        const store = createStoreWithLayouts({
            'mobile|0': [
                { name: 'temperature', visible: true },
                // 'nonexistent' prefix is not in registeredPanels — isPanelKnown returns false
                { name: 'nonexistent', visible: true },
                { name: 'webcam', visible: true },
                // Another unknown panel
                { name: 'unknown_panel', visible: true },
            ],
        })
        const wrapper = mount(DashboardPage, {
            global: {
                plugins: [store],
            },
        })

        // Known panels are rendered
        expect(wrapper.findComponent({ name: 'TemperaturePanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'WebcamPanel' }).exists()).toBe(true)

        // Unknown panels (not in registeredPanels) are NOT rendered
        // 'nonexistent' has no matching prefix -> getPanelComponent returns null -> isPanelKnown returns false
        expect(wrapper.findComponent({ name: 'NonexistentPanel' }).exists()).toBe(false)
        // 'unknown_panel' -> prefix 'unknown' not in registeredPanels -> not rendered
        expect(wrapper.findComponent({ name: 'UnknownPanel' }).exists()).toBe(false)
    })

    // ─── Viewport Mutually Exclusive ─────────────────────────────────────

    it('only renders one viewport mode at a time (mobile takes priority)', () => {
        // Set ALL viewport flags true — v-if/v-else-if chain means
        // only the first match (isMobile) should render.
        mockDashboard.isMobile.value = true
        mockDashboard.isTablet.value = true
        mockDashboard.isDesktop.value = true
        mockDashboard.isWidescreen.value = true

        const store = createStoreWithLayouts({
            'mobile|0': [{ name: 'temperature', visible: true }],
            'desktop|1': [{ name: 'jog', visible: true }],
            'widescreen|1': [{ name: 'webcam', visible: true }],
            'widescreen|2': [],
            'widescreen|3': [],
            'tablet|1': [{ name: 'dro', visible: true }],
            'tablet|2': [],
        })
        const wrapper = mount(DashboardPage, {
            global: {
                plugins: [store],
            },
        })

        // Only mobile panels should render
        expect(wrapper.findComponent({ name: 'TemperaturePanel' }).exists()).toBe(true)

        // Panels from other modes should NOT render
        expect(wrapper.findComponent({ name: 'JogPanel' }).exists()).toBe(false)
        expect(wrapper.findComponent({ name: 'WebcamPanel' }).exists()).toBe(false)
        expect(wrapper.findComponent({ name: 'DroPanel' }).exists()).toBe(false)
    })
})
