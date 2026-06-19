import { describe, it, expect, vi } from 'vitest'
import { useDashboard } from '@/composables/useDashboard'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'
import {
    mdiArrowCollapseVertical,
    mdiCodeTags,
    mdiConsoleLine,
    mdiCrosshairsGps,
    mdiDipSwitch,
    mdiEngine,
    mdiGrid,
    mdiHandBackRight,
    mdiInformation,
    mdiLedStrip,
    mdiThermometerLines,
    mdiWebcam,
    mdiAxisArrow,
} from '@mdi/js'

vi.mock('vuetify', () => ({
    useDisplay: () => ({
        mobile: ref(false),
        smAndUp: ref(true),
        lgAndUp: ref(false),
        xl: ref(false),
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => {
            if (key === 'Panels.MachineSettingsPanel.Headline') return 'Machine Settings'
            if (key === 'Panels.MiniconsolePanel.Headline') return 'Miniconsole'
            if (key === 'Panels.MiscellaneousPanel.Headline') return 'Miscellaneous'
            if (key === 'Panels.LedEffectsPanel.Headline') return 'LED Effects'
            if (key === 'Panels.MacrosPanel.Headline') return 'Macros'
            if (key === 'Panels.TemperaturePanel.Headline') return 'Temperature'
            if (key === 'Panels.WebcamPanel.Headline') return 'Webcam'
            return key
        },
    }),
}))

function mountComposable(overrides: Record<string, any> = {}) {
    const store = createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [], port: 80, hostname: 'localhost' },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                registered_directories: [],
                config: { config: {} },
            },
            printer: { app_name: 'Klipper', print_stats: { state: 'standby' }, idle_timeout: { state: 'Idle' } },
            gui: {
                general: { timeFormat: '24hours', dateFormat: 'yyyy-mm-dd' },
                uiSettings: { powerDeviceName: null },
            },
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => 'ws://localhost:80/websocket',
            'socket/getHostUrl': () => 'http://localhost:80',
            'server/power/getDevices': () => [],
            'gui/getHours12Format': () => false,
            'gui/macros/getAllMacrogroups': () => [],
            'gui/webcams/getWebcams': () => [],
            ...overrides.getters,
        } as any,
    })

    let result: any
    const TestComponent = {
        template: '<div></div>',
        setup() {
            result = useDashboard()
            return {}
        },
    }
    mount(TestComponent, { global: { plugins: [store] } })
    return result
}

describe('useDashboard', () => {
    it('returns useBase viewport properties', () => {
        const c = mountComposable()
        expect(c).toHaveProperty('isMobile')
        expect(c).toHaveProperty('isTablet')
        expect(c).toHaveProperty('isDesktop')
        expect(c).toHaveProperty('isWidescreen')
        expect(c).toHaveProperty('viewport')
    })

    it('returns macrogroups from store getter', () => {
        const c = mountComposable()
        expect(c.macrogroups.value).toEqual([])
    })

    it('returns webcams from store getter', () => {
        const c = mountComposable()
        expect(c.webcams.value).toEqual([])
    })

    it('returns empty array for macrogroups when getter returns null', () => {
        const c = mountComposable({
            getters: {
                'gui/macros/getAllMacrogroups': () => null,
            },
        })
        expect(c.macrogroups.value).toEqual([])
    })

    it('returns empty array for webcams when getter returns null', () => {
        const c = mountComposable({
            getters: {
                'gui/webcams/getWebcams': () => null,
            },
        })
        expect(c.webcams.value).toEqual([])
    })

    it('returns macrogroup name for macrogroup_ prefix with empty id', () => {
        const c = mountComposable({
            getters: {
                'gui/macros/getAllMacrogroups': () => [
                    {
                        id: '',
                        name: 'Empty Group',
                        color: 'primary',
                        showInStandby: true,
                        showInPrinting: true,
                        showInPause: true,
                    },
                ],
            },
        })
        expect(c.getPanelName('macrogroup_')).toBe('Empty Group')
    })

    describe('getPanelName', () => {
        it('returns macrogroup name for macrogroup_ prefix', () => {
            const c = mountComposable({
                getters: {
                    'gui/macros/getAllMacrogroups': () => [
                        {
                            id: 'g1',
                            name: 'My Group',
                            color: 'primary',
                            showInStandby: true,
                            showInPrinting: true,
                            showInPause: true,
                        },
                    ],
                },
            })
            expect(c.getPanelName('macrogroup_g1')).toBe('My Group')
        })

        it('returns Macrogroup fallback for unknown macrogroup', () => {
            const c = mountComposable()
            expect(c.getPanelName('macrogroup_unknown')).toBe('Macrogroup')
        })

        it('returns CNC Status for cnc-status', () => {
            const c = mountComposable()
            expect(c.getPanelName('cnc-status')).toBe('CNC Status')
        })

        it('returns DRO for dro', () => {
            const c = mountComposable()
            expect(c.getPanelName('dro')).toBe('DRO')
        })

        it('returns Jog for jog', () => {
            const c = mountComposable()
            expect(c.getPanelName('jog')).toBe('Jog')
        })

        it('returns WCS for wcs, offsets, offset-preview', () => {
            const c = mountComposable()
            expect(c.getPanelName('wcs')).toBe('WCS')
            expect(c.getPanelName('offsets')).toBe('WCS')
            expect(c.getPanelName('offset-preview')).toBe('WCS')
        })

        it('returns Spindle & Coolant for spindle-coolant', () => {
            const c = mountComposable()
            expect(c.getPanelName('spindle-coolant')).toBe('Spindle & Coolant')
        })

        it('returns MDI for mdi', () => {
            const c = mountComposable()
            expect(c.getPanelName('mdi')).toBe('MDI')
        })

        it('returns i18n translated name for dashed panel names', () => {
            const c = mountComposable()
            expect(c.getPanelName('machine-settings')).toBe('Machine Settings')
        })

        it('returns i18n translated name for simple panel names', () => {
            const c = mountComposable()
            expect(c.getPanelName('webcam')).toBe('Webcam')
        })
    })

    describe('convertPanelnameToIcon', () => {
        it('returns mdiCodeTags for macrogroup_', () => {
            const c = mountComposable()
            expect(c.convertPanelnameToIcon('macrogroup_g1')).toBe(mdiCodeTags)
        })

        it('returns correct icons for known panel names', () => {
            const c = mountComposable()
            expect(c.convertPanelnameToIcon('webcam')).toBe(mdiWebcam)
            expect(c.convertPanelnameToIcon('zoffset')).toBe(mdiArrowCollapseVertical)
            expect(c.convertPanelnameToIcon('macros')).toBe(mdiCodeTags)
            expect(c.convertPanelnameToIcon('miscellaneous')).toBe(mdiDipSwitch)
            expect(c.convertPanelnameToIcon('led-effects')).toBe(mdiLedStrip)
            expect(c.convertPanelnameToIcon('temperature')).toBe(mdiThermometerLines)
            expect(c.convertPanelnameToIcon('miniconsole')).toBe(mdiConsoleLine)
            expect(c.convertPanelnameToIcon('machine-settings')).toBe(mdiEngine)
            expect(c.convertPanelnameToIcon('cnc-status')).toBe(mdiAxisArrow)
            expect(c.convertPanelnameToIcon('dro')).toBe(mdiCrosshairsGps)
            expect(c.convertPanelnameToIcon('jog')).toBe(mdiHandBackRight)
            expect(c.convertPanelnameToIcon('wcs')).toBe(mdiGrid)
            expect(c.convertPanelnameToIcon('offsets')).toBe(mdiGrid)
            expect(c.convertPanelnameToIcon('offset-preview')).toBe(mdiGrid)
            expect(c.convertPanelnameToIcon('spindle-coolant')).toBe(mdiEngine)
            expect(c.convertPanelnameToIcon('mdi')).toBe(mdiConsoleLine)
        })

        it('returns mdiInformation for unknown panel', () => {
            const c = mountComposable()
            expect(c.convertPanelnameToIcon('unknown')).toBe(mdiInformation)
        })
    })
})
