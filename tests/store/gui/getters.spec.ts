import { describe, it, expect, vi } from 'vitest'
import { getters } from '@/store/gui/getters'
import type { GuiState } from '@/store/gui/types'

vi.mock('@/store/variables', () => ({
    allDashboardPanels: [
        'webcam',
        'temperature',
        'dro',
        'jog',
        'cnc-status',
        'macros',
        'machine-settings',
        'miscellaneous',
        'spindle-coolant',
        'wcs',
        'offsets',
        'offset-preview',
        'mdi',
        'miniconsole',
        'led-effects',
    ],
    defaultTheme: 'mainsail',
    themes: [
        { name: 'mainsail', displayName: 'Mainsail', colorLogo: '#D41216' },
        { name: 'dark', displayName: 'Dark', colorLogo: '#FFB74D' },
    ],
}))

const defaultState = (overrides: Partial<GuiState> = {}): any => ({
    general: {
        printername: 'Test',
        language: 'en',
        dateFormat: null,
        timeFormat: null,
        calcPrintProgress: 'file-relative',
        calcEstimateTime: ['file', 'filament'],
        calcEtaTime: ['file', 'filament', 'slicer'],
    },
    control: {
        style: 'bars',
        actionButton: null,
        hideDuringPrint: false,
        enableXYHoming: false,
        feedrateXY: 100,
        stepsXY: [100, 10, 1],
        feedrateZ: 25,
        offsetsZ: [0.005, 0.01, 0.025, 0.05],
        offsetZSaveOption: null,
        stepsZ: [25, 1, 0.1],
        stepsAll: [0.1, 1, 10, 25, 50, 100],
        stepsCircleXY: [1, 10, 50, 100],
        stepsCircleZ: [0.1, 1, 10, 50],
        selectedCrossStep: null,
        selectedCncStepIndex: 2,
        cncFeedrateXY: 500,
        cncFeedrateZ: 100,
        reverseX: false,
        reverseY: false,
        reverseZ: false,
    },
    dashboard: {
        nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
        mobileLayout: [{ name: 'webcam', visible: false }],
        tabletLayout1: [{ name: 'webcam', visible: true }],
        desktopLayout1: [{ name: 'webcam', visible: true }],
        desktopLayout2: [{ name: 'temperature', visible: true }],
        widescreenLayout1: [],
        widescreenLayout2: [],
        widescreenLayout3: [],
        floatingPanels: {},
    },
    editor: {
        escToClose: true,
        confirmUnsavedChanges: true,
        klipperRestartMethod: 'FIRMWARE_RESTART',
        tabSize: 2,
        fileStructureSidebar: true,
    },
    gcodeViewer: {
        extruderColors: [],
        gridColor: '#B3B3B3',
        backgroundColor: '#121212',
        colorMode: 2,
        showAxes: true,
        minFeed: 20,
        maxFeed: 100,
        minFeedColor: '#2196f3',
        maxFeedColor: '#D41216',
        progressColor: '#ECECEC',
        showCursor: true,
        showTravelMoves: false,
        showObjectSelection: false,
        hdRendering: false,
        forceLineRendering: false,
        transparency: false,
        voxelMode: false,
        voxelWidth: 1,
        voxelHeight: 1,
        specularLighting: false,
        klipperCache: { kinematics: null, axis_minimum: null, axis_maximum: null },
        showGCodePanel: false,
    },
    navigationSettings: { entries: [] },
    uiSettings: {
        mode: 'dark',
        theme: 'mainsail',
        logo: '#D41216',
        primary: '#2196f3',
        displayCancelPrint: false,
        lockSlidersOnTouchDevices: true,
        lockSlidersDelay: 1.5,
        confirmOnEmergencyStop: false,
        confirmOnCoolDown: false,
        confirmOnPowerDeviceChange: false,
        confirmOnCancelJob: false,
        confirmOnCancelJobWarning: true,
        boolBigThumbnail: true,
        bigThumbnailBackground: '#1e1e1e',
        boolWideNavDrawer: false,
        boolHideUploadAndPrintButton: false,
        navigationStyle: 'iconsAndText',
        defaultNavigationStateSetting: 'alwaysOpen',
        powerDeviceName: null,
        progressAsFavicon: true,
        disableFanAnimation: false,
        boolManualProbeDialog: true,
        tempchartHeight: 250,
        hideUpdateWarnings: false,
        printstatusThumbnailZoom: true,
        dashboardFilesLimit: 5,
        dashboardFilesFilter: ['new', 'failed', 'completed'],
        dashboardHistoryLimit: 5,
        hideOtherInstances: false,
    },
    macros: {
        mode: 'simple',
        hiddenMacros: [],
        macrogroups: {},
    },
    view: {
        blockFileUpload: false,
        configfiles: {
            countPerPage: 10,
            sortBy: 'filename',
            sortDesc: false,
            showHiddenFiles: false,
            hideBackupFiles: false,
            currentPath: '',
            rootPath: 'config',
            selectedFiles: [],
        },
        gcodefiles: {
            countPerPage: 10,
            search: '',
            sortBy: 'modified',
            sortDesc: true,
            showHiddenFiles: false,
            showCompletedFiles: true,
            hideMetadataColumns: [],
            orderMetadataColumns: [],
            currentPath: '',
            selectedFiles: [],
        },
        history: {
            countPerPage: 10,
            toggleChartCol2: 'chart',
            toggleChartCol3: 'filament_usage',
            hidePrintStatus: [],
            hideColums: [],
            selectedJobs: [],
            showMaintenanceEntries: true,
            showPrintJobs: true,
        },
        jobqueue: { countPerPage: 10 },
        lockedSliders: [],
        mmu: {
            showClogDetection: true,
            showTtgMap: true,
            showDetails: true,
            largeFilamentStatus: false,
            showLogos: true,
            showName: true,
            showUnavailableSpoolColor: false,
        },
        tempchart: {
            boolTempchart: true,
            hiddenDataset: [],
            hideMcuHostSensors: false,
            hideMonitors: false,
            autoscale: false,
            datasetSettings: {},
        },
        timelapse: {
            countPerPage: 10,
            sortBy: 'modified',
            sortDesc: true,
            showHiddenFiles: false,
            currentPath: 'timelapse',
            selectedFiles: [],
        },
        webcam: { currentCam: { dashboard: 'all', page: 'all' } },
    },
    ...overrides,
})

describe('gui getters', () => {
    it('theme returns the current theme name', () => {
        const state = defaultState({ uiSettings: { theme: 'dark' } as any })
        expect((getters as any).theme(state)).toBe('dark')
    })

    it('theme falls back to default if theme not found in themes list', () => {
        const state = defaultState({ uiSettings: { theme: 'nonexistent' } as any })
        expect((getters as any).theme(state)).toBe('mainsail')
    })

    it('getTheme returns the full theme object', () => {
        const state = defaultState()
        const themeGetter = vi.fn(() => 'mainsail')
        const result = (getters as any).getTheme(state, { theme: themeGetter })
        expect(result.name).toBe('mainsail')
    })

    it('getDatasetValue returns stored value', () => {
        const state = defaultState({
            view: { tempchart: { datasetSettings: { extruder: { color: '#F44336' } } } } as any,
        })
        const result = (getters as any).getDatasetValue(state)({ name: 'extruder', type: 'color' })
        expect(result).toBe('#F44336')
    })

    it('getDatasetValue returns default for temperature/target', () => {
        const state = defaultState()
        const result = (getters as any).getDatasetValue(state)({ name: 'extruder', type: 'temperature' })
        expect(result).toBe(true)
    })

    it('getDatasetAdditionalSensorValue returns stored value', () => {
        const state = defaultState({
            view: { tempchart: { datasetSettings: { extruder: { additionalSensors: { power: false } } } } } as any,
        })
        const result = (getters as any).getDatasetAdditionalSensorValue(state)({ name: 'extruder', sensor: 'power' })
        expect(result).toBe(false)
    })

    it('getDatasetAdditionalSensorValue defaults to true', () => {
        const state = defaultState()
        const result = (getters as any).getDatasetAdditionalSensorValue(state)({ name: 'extruder', sensor: 'power' })
        expect(result).toBe(true)
    })

    it('getPanelExpand returns true when panel not in nonExpandPanels', () => {
        const state = defaultState()
        const result = (getters as any).getPanelExpand(state)('temperature', 'desktop')
        expect(result).toBe(true)
    })

    it('getPanelExpand returns false when panel is in nonExpandPanels', () => {
        const state = defaultState({
            dashboard: { nonExpandPanels: { desktop: ['temperature'] } } as any,
        })
        const result = (getters as any).getPanelExpand(state)('temperature', 'desktop')
        expect(result).toBe(false)
    })

    it('getDefaultControlActionButton returns qgl when printer existsQGL', () => {
        const rootGetters = { 'printer/existsQGL': true }
        const result = (getters as any).getDefaultControlActionButton({}, {}, {}, rootGetters)
        expect(result).toBe('qgl')
    })

    it('getDefaultControlActionButton returns m84 by default', () => {
        const rootGetters = { 'printer/existsQGL': false }
        const result = (getters as any).getDefaultControlActionButton({}, {}, {}, rootGetters)
        expect(result).toBe('m84')
    })

    it('getHours12Format returns true for 12hours setting', () => {
        const state = defaultState({ general: { timeFormat: '12hours' } as any })
        expect((getters as any).getHours12Format(state)).toBe(true)
    })

    it('getHours12Format returns false for 24hours setting', () => {
        const state = defaultState({ general: { timeFormat: '24hours' } as any })
        expect((getters as any).getHours12Format(state)).toBe(false)
    })

    it('getDatasetValue returns false by default for non-temperature datasets', () => {
        const state = defaultState()
        const result = (getters as any).getDatasetValue(state)({ name: 'extruder', type: 'power' })
        expect(result).toBe(false)
    })

    it('getDatasetAdditionalSensorValue returns true when additionalSensors are missing', () => {
        const state = defaultState({
            view: { tempchart: { datasetSettings: { extruder: { color: '#fff' } } } } as any,
        })
        const result = (getters as any).getDatasetAdditionalSensorValue(state)({ name: 'extruder', sensor: 'power' })
        expect(result).toBe(true)
    })

    it('getAllPossiblePanels adapts to expert macros and printer capabilities', () => {
        const state = defaultState({ macros: { mode: 'expert' } as any })
        const result = (getters as any).getAllPossiblePanels(
            state,
            {
                'macros/getAllMacrogroups': [{ id: 'grp1' }],
                'webcams/getWebcams': [],
            },
            {
                printer: {
                    heaters: { available_sensors: [] },
                },
            },
            {
                'printer/getKinematics': 'none',
            }
        )

        expect(result).toContain('macrogroup_grp1')
        expect(result).not.toContain('macros')
        expect(result).not.toContain('machine-settings')
        expect(result).not.toContain('temperature')
        expect(result).not.toContain('webcam')
        expect(result).not.toContain('led-effects')
    })

    it('getAllPossiblePanels keeps led-effects when a led_effect object exists', () => {
        const state = defaultState()
        const result = (getters as any).getAllPossiblePanels(
            state,
            {
                'macros/getAllMacrogroups': [],
                'webcams/getWebcams': [{ name: 'cam1' }],
            },
            {
                printer: {
                    heaters: { available_sensors: ['extruder'] },
                    'led_effect rainbow': {},
                },
            },
            {
                'printer/getKinematics': 'cartesian',
            }
        )

        expect(result).toContain('led-effects')
        expect(result).toContain('webcam')
        expect(result).toContain('temperature')
    })

    it('getPanels adds missing first-column panels and filters hidden ones when onlyVisible is true', () => {
        const state = defaultState({
            dashboard: {
                ...defaultState().dashboard,
                desktopLayout1: [{ name: 'webcam', visible: false }],
            } as any,
        })
        const result = (getters as any).getPanels(
            state,
            {
                getAllPossiblePanels: ['webcam', 'temperature'],
                getAllPanelsFromViewport: vi.fn(() => [{ name: 'webcam', visible: false }]),
                'macros/getAllMacrogroups': [],
            },
            { gui: { macros: { mode: 'simple' } } }
        )('desktop', 1, true)

        expect(result).toEqual([{ name: 'temperature', visible: true }])
    })

    it('getPanels removes macros panel in expert mode and keeps only existing macrogroup panels', () => {
        const state = defaultState({
            dashboard: {
                ...defaultState().dashboard,
                desktopLayout1: [
                    { name: 'macros', visible: true },
                    { name: 'macrogroup_exists', visible: true },
                    { name: 'macrogroup_missing', visible: true },
                ],
            } as any,
        })
        const result = (getters as any).getPanels(
            state,
            {
                getAllPossiblePanels: ['macros', 'macrogroup_exists', 'macrogroup_missing'],
                getAllPanelsFromViewport: vi.fn(() => state.dashboard.desktopLayout1),
                'macros/getAllMacrogroups': [{ id: 'exists' }],
            },
            { gui: { macros: { mode: 'expert' } } }
        )('desktop', 1)

        expect(result.map((panel: any) => panel.name)).toEqual(['macrogroup_exists'])
    })

    it('getAllPanelsFromViewport collects base and numbered layouts', () => {
        const state = defaultState({
            dashboard: {
                baseLayout: [{ name: 'webcam', visible: true }],
                baseLayout1: [{ name: 'temperature', visible: true }],
                baseLayout2: [{ name: 'dro', visible: true }],
            } as any,
        })

        const result = (getters as any).getAllPanelsFromViewport(state)('base')
        expect(result.map((panel: any) => panel.name)).toEqual(['webcam', 'temperature', 'dro'])
    })

    it('getHours12Format uses Intl when setting is null', () => {
        const spy = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
            resolvedOptions: () => ({ hour12: true }),
        } as any)

        const state = defaultState({ general: { timeFormat: null } as any })
        expect((getters as any).getHours12Format(state)).toBe(true)

        spy.mockRestore()
    })
})
