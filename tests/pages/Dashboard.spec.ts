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

// --- Mock @/composables/useDashboard — isMobile, isTablet, isDesktop, isWidescreen as ref-like objects ---
vi.mock('@/composables/useDashboard', () => ({
    useDashboard: () => ({
        isMobile: { value: false, __v_isRef: true },
        isTablet: { value: false, __v_isRef: true },
        isDesktop: { value: true, __v_isRef: true },
        isWidescreen: { value: false, __v_isRef: true },
    }),
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

    it('renders dynamic panels from layout definition', () => {
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

        // Dynamic panels from layout1 (v-col-5)
        expect(wrapper.findComponent({ name: 'TemperaturePanel' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'WebcamPanel' }).exists()).toBe(true)

        // Dynamic panels from layout2 (v-col-7)
        expect(wrapper.findComponent({ name: 'JogPanel' }).exists()).toBe(true)
    })
})
