import { describe, it, expect, beforeEach, vi } from 'vitest'
import { actions } from '@/store/gui/actions'
import { getDefaultState } from '@/store/gui/index'
import type { GuiState } from '@/store/gui/types'

const mockSocket = vi.hoisted(() => ({
    emit: vi.fn(),
}))
const mockToast = vi.hoisted(() => ({
    error: vi.fn(),
    success: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => mockSocket,
    $toast: mockToast,
}))

vi.mock('@/store/variables', () => ({
    excludeKeys: ['dashboard.floatingPanels'],
    themeDir: '.theme',
    defaultMode: 'dark',
    defaultTheme: 'mainsail',
    defaultLogoColor: '#D41216',
    defaultPrimaryColor: '#2196f3',
    defaultBigThumbnailBackground: '#1e1e1e',
    themes: [
        { name: 'mainsail', colorLogo: '#D41216', colorPrimary: '#2196f3' },
        { name: 'dark', colorLogo: '#FFB74D', colorPrimary: '#0000ff' },
    ],
}))

vi.mock('@/plugins/helpers', () => ({
    deletePath: vi.fn(),
    isRecord: (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v),
}))

describe('gui actions', () => {
    let state: GuiState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    it('reset commits reset and resets sub-modules', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        actions.reset({ commit, dispatch } as any)
        expect(commit).toHaveBeenCalledWith('reset')
        expect(dispatch).toHaveBeenCalledWith('console/reset')
        expect(dispatch).toHaveBeenCalledWith('gcodehistory/reset')
        expect(dispatch).toHaveBeenCalledWith('macros/reset')
        expect(dispatch).toHaveBeenCalledWith('webcams/reset')
    })

    it('init emits database get_item', () => {
        actions.init()
        expect(mockSocket.emit).toHaveBeenCalledWith(
            'server.database.get_item',
            { namespace: 'mainsail' },
            { action: 'gui/initStore' }
        )
    })

    it('saveSetting commits and emits, excludes some keys', () => {
        const commit = vi.fn()
        actions.saveSetting({ commit } as any, { name: 'general.printername', value: 'My CNC' })
        expect(commit).toHaveBeenCalledWith('saveSetting', { name: 'general.printername', value: 'My CNC' })
        expect(mockSocket.emit).toHaveBeenCalledWith('server.database.post_item', {
            namespace: 'mainsail',
            key: 'general.printername',
            value: 'My CNC',
        })
    })

    it('saveSetting skips socket emit for excluded keys', () => {
        const commit = vi.fn()
        actions.saveSetting({ commit } as any, { name: 'dashboard.floatingPanels', value: {} })
        expect(commit).toHaveBeenCalled()
        expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it('updateSettings emits database post_item', () => {
        actions.updateSettings({} as any, {
            keyName: 'view.gcodefiles.hideMetadataColumns',
            value: ['size'],
            newVal: ['size'],
        })
        expect(mockSocket.emit).toHaveBeenCalledWith('server.database.post_item', {
            namespace: 'mainsail',
            key: 'view.gcodefiles.hideMetadataColumns',
            value: ['size'],
        })
    })

    it('setGcodefilesMetadata commits and updates settings', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { view: { gcodefiles: { hideMetadataColumns: ['size'] } } }
        actions.setGcodefilesMetadata({ commit, dispatch, state: stateMock as any } as any, {
            name: 'size',
            value: false,
        })
        expect(commit).toHaveBeenCalledWith('setGcodefilesMetadata', { name: 'size', value: false })
        expect(dispatch).toHaveBeenCalledWith('updateSettings', {
            keyName: 'view.gcodefiles.hideMetadataColumns',
            newVal: ['size'],
        })
    })

    it('setGcodefilesShowHiddenFiles commits and updates settings', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { view: { gcodefiles: { showHiddenFiles: true } } }
        actions.setGcodefilesShowHiddenFiles({ commit, dispatch, state: stateMock as any } as any, true)
        expect(commit).toHaveBeenCalledWith('setGcodefilesShowHiddenFiles', true)
        expect(dispatch).toHaveBeenCalledWith('updateSettings', {
            keyName: 'view.gcodefiles.showHiddenFiles',
            newVal: true,
        })
    })

    it('setCurrentWebcam commits and updates settings', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { view: { webcam: { currentCam: { dashboard: 'cam1' } } } }
        actions.setCurrentWebcam({ commit, dispatch, state: stateMock as any } as any, {
            page: 'dashboard',
            value: 'cam1',
        })
        expect(commit).toHaveBeenCalledWith('setCurrentWebcam', { page: 'dashboard', value: 'cam1' })
        expect(dispatch).toHaveBeenCalledWith('updateSettings', {
            keyName: 'view.webcam.currentCam',
            newVal: { dashboard: 'cam1' },
        })
    })

    it('setHistoryColumns commits and updates settings', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { view: { history: { hideColums: ['size'] } } }
        actions.setHistoryColumns({ commit, dispatch, state: stateMock as any } as any, {
            name: 'size',
            value: false,
        })
        expect(commit).toHaveBeenCalledWith('setHistoryColumns', { name: 'size', value: false })
        expect(dispatch).toHaveBeenCalledWith('updateSettings', {
            keyName: 'view.history',
            newVal: { hideColums: ['size'] },
        })
    })

    it('toggleStatusInHistoryList toggles print status', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { view: { history: { hidePrintStatus: ['printing'] } } }
        actions.toggleStatusInHistoryList({ commit, dispatch, state: stateMock as any } as any, 'paused')
        expect(commit).toHaveBeenCalledWith('setHistoryHidePrintStatus', ['printing', 'paused'])
    })

    it('toggleStatusInHistoryList removes existing status', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { view: { history: { hidePrintStatus: ['printing'] } } }
        actions.toggleStatusInHistoryList({ commit, dispatch, state: stateMock as any } as any, 'printing')
        expect(commit).toHaveBeenCalledWith('setHistoryHidePrintStatus', [])
    })

    it('saveExpandPanel closes a panel', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { dashboard: { nonExpandPanels: { desktop: [] } } }
        actions.saveExpandPanel({ commit, dispatch, state: stateMock as any } as any, {
            name: 'temperature',
            viewport: 'desktop',
            value: false,
        })
        expect(commit).toHaveBeenCalledWith('addClosePanel', { name: 'temperature', viewport: 'desktop' })
        expect(dispatch).toHaveBeenCalledWith('updateSettings', {
            keyName: 'dashboard.nonExpandPanels.desktop',
            newVal: [],
        })
    })

    it('saveExpandPanel opens a panel', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { dashboard: { nonExpandPanels: { desktop: ['temperature'] } } }
        actions.saveExpandPanel({ commit, dispatch, state: stateMock as any } as any, {
            name: 'temperature',
            viewport: 'desktop',
            value: true,
        })
        expect(commit).toHaveBeenCalledWith('removeClosePanel', { name: 'temperature', viewport: 'desktop' })
    })

    it('resetLayout resets layout to defaults', () => {
        const dispatch = vi.fn()
        actions.resetLayout({ dispatch } as any, 'desktopLayout1')
        expect(dispatch).toHaveBeenCalledWith('saveSetting', {
            name: 'dashboard.desktopLayout1',
            value: expect.any(Array),
        })
    })

    it('updateGcodeviewerCache saves changed cache values', () => {
        const dispatch = vi.fn()
        const stateMock = {
            gcodeViewer: {
                klipperCache: { kinematics: null, axis_minimum: null, axis_maximum: null },
            },
        }
        actions.updateGcodeviewerCache({ dispatch, state: stateMock as any } as any, { kinematics: 'corexy' })
        expect(dispatch).toHaveBeenCalledWith('saveSetting', {
            name: 'gcodeViewer.klipperCache.kinematics',
            value: 'corexy',
        })
    })

    it('updateGcodeviewerCache skips unchanged values', () => {
        const dispatch = vi.fn()
        const stateMock = {
            gcodeViewer: {
                klipperCache: { kinematics: null, axis_minimum: null, axis_maximum: null },
            },
        }
        actions.updateGcodeviewerCache({ dispatch, state: stateMock as any } as any, { kinematics: null })
        expect(dispatch).not.toHaveBeenCalled()
    })

    it('setChartDatasetStatus commits and updates settings', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { view: { tempchart: { datasetSettings: {} } } }
        actions.setChartDatasetStatus({ commit, dispatch, state: stateMock as any } as any, {
            objectName: 'extruder',
            dataset: 'temperature',
            value: true,
        })
        expect(commit).toHaveBeenCalledWith('setChartDatasetStatus', {
            objectName: 'extruder',
            dataset: 'temperature',
            value: true,
        })
        expect(dispatch).toHaveBeenCalledWith('updateSettings', {
            keyName: 'view.tempchart.datasetSettings',
            newVal: {},
        })
    })

    it('saveFloatingPanelPosition saves position', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { dashboard: { floatingPanels: {} } }
        actions.saveFloatingPanelPosition({ commit, dispatch, state: stateMock as any } as any, {
            id: 'panel1',
            position: { x: 100, y: 50, width: 300, height: 200, zIndex: 1 },
        })
        expect(commit).toHaveBeenCalledWith('setFloatingPanels', {
            panel1: { x: 100, y: 50, width: 300, height: 200, zIndex: 1 },
        })
    })

    it('saveFloatingPanelPosition removes panel', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = {
            dashboard: { floatingPanels: { panel1: { x: 100, y: 50, width: 300, height: 200, zIndex: 1 } } },
        }
        actions.saveFloatingPanelPosition({ commit, dispatch, state: stateMock as any } as any, {
            id: 'panel1',
            remove: true,
        })
        expect(commit).toHaveBeenCalledWith('setFloatingPanels', {})
    })

    it('bringFloatingPanelToFront increments zIndex', () => {
        const dispatch = vi.fn()
        const stateMock = {
            dashboard: {
                floatingPanels: {
                    panel1: { x: 0, y: 0, width: 100, height: 100, zIndex: 1 },
                    panel2: { x: 0, y: 0, width: 100, height: 100, zIndex: 5 },
                },
            },
        }
        actions.bringFloatingPanelToFront({ dispatch, state: stateMock as any } as any, 'panel1')
        expect(dispatch).toHaveBeenCalledWith('saveFloatingPanelPosition', {
            id: 'panel1',
            position: { x: 0, y: 0, width: 100, height: 100, zIndex: 6 },
        })
    })

    it('saveSetting applies theme logo and primary colors for known themes', () => {
        const commit = vi.fn()
        actions.saveSetting({ commit } as any, { name: 'uiSettings.theme', value: 'dark' })

        expect(commit).toHaveBeenCalledWith('saveSetting', { name: 'uiSettings.theme', value: 'dark' })
        expect(commit).toHaveBeenCalledWith('saveSetting', { name: 'uiSettings.logo', value: '#FFB74D' })
        expect(commit).toHaveBeenCalledWith('saveSetting', { name: 'uiSettings.primary', value: '#0000ff' })
    })

    it('updateSettings merges object values when the current value is an object', () => {
        actions.updateSettings({} as any, {
            keyName: 'view.tempchart',
            value: { 'view.tempchart': { autoscale: false, boolTempchart: true } },
            newVal: { autoscale: true },
        })

        expect(mockSocket.emit).toHaveBeenCalledWith('server.database.post_item', {
            namespace: 'mainsail',
            key: 'view.tempchart',
            value: { autoscale: true, boolTempchart: true },
        })
    })

    it('setTempchartDatasetAdditionalSensorSetting commits and updates tempchart settings', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { view: { tempchart: { datasetSettings: {}, boolTempchart: true } } }

        actions.setTempchartDatasetAdditionalSensorSetting({ commit, dispatch, state: stateMock as any } as any, {
            objectName: 'extruder',
            sensor: 'power',
            value: false,
        })

        expect(commit).toHaveBeenCalledWith('setTempchartDatasetAdditionalSensorSetting', {
            objectName: 'extruder',
            sensor: 'power',
            value: false,
        })
        expect(dispatch).toHaveBeenCalledWith('updateSettings', {
            keyName: 'view.tempchart',
            newVal: stateMock.view.tempchart,
        })
    })

    it('setDatasetAdditionalSensorStatus and setChartColor persist tempchart dataset settings', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const stateMock = { view: { tempchart: { datasetSettings: { extruder: {} } } } }

        actions.setDatasetAdditionalSensorStatus({ commit, dispatch, state: stateMock as any } as any, {
            objectName: 'extruder',
            dataset: 'power',
            value: true,
        })
        actions.setChartColor({ commit, dispatch, state: stateMock as any } as any, {
            objectName: 'extruder',
            value: false,
        })

        expect(commit).toHaveBeenCalledWith('setDatasetAdditionalSensorStatus', {
            objectName: 'extruder',
            dataset: 'power',
            value: true,
        })
        expect(commit).toHaveBeenCalledWith('setChartDatasetStatus', {
            objectName: 'extruder',
            dataset: 'color',
            value: false,
        })
        expect(dispatch).toHaveBeenCalledWith('updateSettings', {
            keyName: 'view.tempchart.datasetSettings',
            newVal: stateMock.view.tempchart.datasetSettings,
        })
    })

    it('initStore migrates legacy gui settings and removes deprecated keys', async () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const fetchMock = vi.fn().mockResolvedValue({ json: vi.fn() })
        vi.stubGlobal('fetch', fetchMock)

        const payload: any = {
            value: {
                remoteprinters: { printers: [{ id: 'remote-1' }] },
                view: {
                    gcodefiles: { currentPath: '/old-gcodes' },
                    configfiles: { currentPath: '/old-config' },
                },
                cooldownGcode: 'M104 S0',
                presets: [{ name: 'Cool', gcode: 'M104 S0' }],
                dashboard: {
                    nonExpandPanels: ['temperature'],
                    desktopLayout1: [{ name: 'tools', visible: true }],
                },
            },
        }

        await actions.initStore(
            {
                commit,
                dispatch,
                rootGetters: { 'socket/getUrl': 'http://moonraker' },
                rootState: { instancesDB: 'moonraker' },
            } as any,
            payload
        )

        expect(dispatch).toHaveBeenCalledWith('remoteprinters/initStore', [{ id: 'remote-1' }])
        expect(fetchMock).toHaveBeenCalledWith(
            'http://moonraker/server/database/item?namespace=mainsail&key=view.gcodefiles.currentPath',
            { method: 'DELETE' }
        )
        expect(fetchMock).toHaveBeenCalledWith(
            'http://moonraker/server/database/item?namespace=mainsail&key=view.configfiles.currentPath',
            { method: 'DELETE' }
        )
        expect(dispatch).toHaveBeenCalledWith('saveSetting', {
            name: 'presets.cooldownGcode',
            value: 'M104 S0',
        })
        expect(dispatch).toHaveBeenCalledWith('presets/store', {
            values: { name: 'Cool', gcode: 'M104 S0' },
        })
        expect(dispatch).toHaveBeenCalledWith('saveSetting', {
            name: 'dashboard.nonExpandPanels.widescreen',
            value: ['temperature'],
        })
        expect(dispatch).toHaveBeenCalledWith('saveSetting', {
            name: 'dashboard.desktopLayout1',
            value: [{ name: 'temperature', visible: true }],
        })
        expect(commit).toHaveBeenCalledWith('setData', payload.value)
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'gui/init', { root: true })
        expect(payload.value).not.toHaveProperty('remoteprinters')
        expect(payload.value).not.toHaveProperty('cooldownGcode')
        expect(payload.value).not.toHaveProperty('presets')
        expect(payload.value.dashboard).not.toHaveProperty('nonExpandPanels')
    })

    it('initDb seeds defaults into mainsail and namespace databases', async () => {
        const dispatch = vi.fn()
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ json: vi.fn().mockResolvedValue({ general: { language: 'en' }, webcams: { cam1: { enabled: true } }, timelapse: { enabled: true } }) })
            .mockResolvedValue({ json: vi.fn().mockResolvedValue({}) })
        vi.stubGlobal('fetch', fetchMock)

        await actions.initDb(
            {
                dispatch,
                rootGetters: {
                    'socket/getUrl': 'http://moonraker',
                    getVersion: '0.7.2',
                },
            } as any
        )

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/server/files/config/.theme/default.json?time='))
        expect(fetchMock).toHaveBeenCalledWith('http://moonraker/server/database/item', expect.objectContaining({ method: 'POST' }))
        expect(dispatch).toHaveBeenCalledWith('init')
    })
})
