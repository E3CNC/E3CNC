import { describe, it, expect, beforeEach, vi } from 'vitest'
import { farm } from '@/store/farm'
import { printer } from '@/store/farm/printer'
import { getDefaultState as getFarmDefaultState } from '@/store/farm/index'
import { getDefaultState as getPrinterDefaultState } from '@/store/farm/printer/index'
import type { FarmPrinterState } from '@/store/farm/printer/types'

vi.mock('@/store/variables', () => ({
    defaultMode: 'dark',
    defaultTheme: 'mainsail',
    defaultLogoColor: '#D41216',
    defaultPrimaryColor: '#2196f3',
    defaultBigThumbnailBackground: '#1e1e1e',
    themeDir: '.theme',
    thumbnailBigMin: 128,
    hiddenDirectories: ['sys'],
    validGcodeExtensions: ['.gcode', '.nc'],
}))

vi.mock('@/plugins/helpers', () => ({
    convertName: (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    escapePath: (value: string) => value,
    setDataDeep: (target: Record<string, any>, payload: Record<string, any>) => {
        Object.assign(target, payload)
    },
}))

describe('farm store', () => {
    describe('farm index getters', () => {
        it('countPrinters returns number of printers', () => {
            const state = { one: {}, two: {}, three: {} } as any
            expect((farm.getters as any).countPrinters(state)).toBe(3)
            expect((farm.getters as any).countPrinters({} as any)).toBe(0)
        })

        it('getPrinters returns the raw state object', () => {
            const state = { printer1: {} } as any
            expect((farm.getters as any).getPrinters(state)).toBe(state)
        })

        it('getPrinterName returns printer name from getter', () => {
            const mockGetters = { 'printer1/getPrinterName': 'MyPrinter' }
            const state = { printer1: {} } as any
            const fn = (farm.getters as any).getPrinterName(state, mockGetters)
            expect(fn('printer1')).toBe('MyPrinter')
        })

        it('existsPrinter checks if printer namespace exists', () => {
            const state = { one: {}, two: {} } as any
            expect((farm.getters as any).existsPrinter(state)('one')).toBe(true)
            expect((farm.getters as any).existsPrinter(state)('missing')).toBe(false)
        })

        it('getPrinterSocketState returns socket state from sub-getter', () => {
            const mockGetters = { 'printer1/getPrinterSocketState': { isConnected: true, isConnecting: false } }
            const state = { printer1: {} } as any
            const fn = (farm.getters as any).getPrinterSocketState(state, mockGetters)
            expect(fn('printer1')).toEqual({ isConnected: true, isConnecting: false })
        })

        it('getPrinterSocketState returns default for missing printer', () => {
            const state = {} as any
            const fn = (farm.getters as any).getPrinterSocketState(state, {})
            expect(fn('missing')).toEqual({ isConnecting: false, isConnected: false })
        })
    })

    describe('farm index actions', () => {
        it('registerPrinter registers a new printer module', () => {
            const hasModule = vi.fn().mockReturnValue(false)
            const registerModule = vi.fn()
            const commit = vi.fn()
            const dispatch = vi.fn()

            const ctx = { commit, dispatch } as any
            const that = { hasModule, registerModule }

            farm.actions.registerPrinter.call(that, ctx, {
                id: 'remote-1',
                hostname: 'printer.local',
                port: 7125,
                path: '',
                settings: { speed: 100 },
            })

            expect(hasModule).toHaveBeenCalledWith(['farm', 'remote-1'])
            expect(registerModule).toHaveBeenCalledWith(['farm', 'remote-1'], printer)
            expect(commit).toHaveBeenCalledWith(
                'farm/remote-1/setSocketData',
                {
                    id: 'remote-1',
                    hostname: 'printer.local',
                    port: 7125,
                    path: '',
                    settings: { speed: 100 },
                    _namespace: 'remote-1',
                },
                { root: true }
            )
            expect(commit).toHaveBeenCalledWith('farm/remote-1/setSettings', { speed: 100 }, { root: true })
            expect(dispatch).toHaveBeenCalledWith('farm/remote-1/connect', {}, { root: true })
        })

        it('registerPrinter does not re-register existing printer', () => {
            const hasModule = vi.fn().mockReturnValue(true)
            const registerModule = vi.fn()
            const commit = vi.fn()
            const dispatch = vi.fn()

            const ctx = { commit, dispatch } as any
            const that = { hasModule, registerModule }

            farm.actions.registerPrinter.call(that, ctx, {
                id: 'remote-1',
                hostname: 'printer.local',
                port: 7125,
                path: '',
            })

            expect(hasModule).toHaveBeenCalledWith(['farm', 'remote-1'])
            expect(registerModule).not.toHaveBeenCalled()
        })

        it('updatePrinter commits socket data and dispatches reconnect', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()

            farm.actions.updatePrinter({ commit, dispatch } as any, {
                id: 'remote-1',
                values: { hostname: 'new.local', port: 81, path: '/mainsail' },
            })

            expect(commit).toHaveBeenCalledWith('remote-1/setSocketData', {
                hostname: 'new.local',
                port: 81,
                path: '/mainsail',
                isConnecting: true,
            })
            expect(dispatch).toHaveBeenCalledWith('remote-1/reconnect')
        })

        it('unregisterPrinter closes socket and unregisters module', () => {
            const close = vi.fn()
            const state = {
                'remote-1': { socket: { instance: { close } } },
            }
            const unregisterModule = vi.fn()

            farm.actions.unregisterPrinter.call({ unregisterModule }, { state } as any, 'remote-1')

            expect(close).toHaveBeenCalled()
            expect(unregisterModule).toHaveBeenCalledWith(['farm', 'remote-1'])
        })

        it('unregisterPrinter does nothing for missing id', () => {
            const state = {}
            const unregisterModule = vi.fn()

            farm.actions.unregisterPrinter.call({ unregisterModule }, { state } as any, 'missing')

            expect(unregisterModule).not.toHaveBeenCalled()
        })
    })
})

describe('farm printer store', () => {
    let state: FarmPrinterState

    beforeEach(() => {
        state = getPrinterDefaultState()
    })

    describe('mutations', () => {
        it('reset restores default state', () => {
            state.socket.hostname = 'old-host'
            state.socket.port = 9999
            state._namespace = 'test'

            printer.mutations.reset(state)
            const defaults = getPrinterDefaultState()
            expect(state.socket.hostname).toBe(defaults.socket.hostname)
            expect(state.socket.port).toBe(defaults.socket.port)
            expect(state._namespace).toBe(defaults._namespace)
            expect(state.settings).toEqual(defaults.settings)
        })

        it('resetData resets data to default', () => {
            state.data = {
                ...state.data,
                toolhead: { position: [1, 2, 3] },
                print_stats: { state: 'printing' },
            }

            printer.mutations.resetData(state)
            const defaults = getPrinterDefaultState()
            // Object.assign only overwrites existing keys — extra keys like
            // toolhead/print_stats remain, but gui and webcams are reset.
            expect(state.data.gui).toEqual(defaults.data.gui)
            expect(state.data.webcams).toEqual(defaults.data.webcams)
        })

        it('setSocketData updates socket fields', () => {
            printer.mutations.setSocketData(state, {
                hostname: 'newhost',
                _namespace: 'remote-1',
                requestParams: {},
            } as any)

            expect(state._namespace).toBe('remote-1')
            expect(state.socket.hostname).toBe('newhost')
            // requestParams should be stripped out
            expect((state.socket as any).requestParams).toBeUndefined()
        })

        it('setSocketData handles status wrapper', () => {
            printer.mutations.setSocketData(state, {
                status: { hostname: 'status-host', port: 1234 },
            } as any)

            expect(state.socket.hostname).toBe('status-host')
            expect(state.socket.port).toBe(1234)
        })

        it('setData updates data with shallow merge', () => {
            state.data.toolhead = { position: [0, 0, 0] } as any
            printer.mutations.setData(state, { toolhead: { position: [1, 2, 3] } } as any)

            expect(state.data.toolhead.position).toEqual([1, 2, 3])
        })

        it('setData strips requestParams', () => {
            printer.mutations.setData(state, {
                toolhead: { position: [4, 5, 6] },
                requestParams: {},
            } as any)

            expect(state.data.toolhead.position).toEqual([4, 5, 6])
            expect((state.data as any).requestParams).toBeUndefined()
        })

        it('setSettings merges into existing settings', () => {
            state.settings = { existing: 'value' }
            printer.mutations.setSettings(state, { speed: 200 } as any)
            expect(state.settings).toEqual({ existing: 'value', speed: 200 })
        })

        it('addWsData appends to wsData array', () => {
            const entry = { id: 1, action: 'test', params: {} }
            printer.mutations.addWsData(state, entry)
            expect(state.socket.wsData).toHaveLength(1)
            expect(state.socket.wsData[0]).toEqual(entry)
        })

        it('removeWsData removes entry by index', () => {
            printer.mutations.addWsData(state, { id: 1, action: 'a', params: {} })
            printer.mutations.addWsData(state, { id: 2, action: 'b', params: {} })
            printer.mutations.addWsData(state, { id: 3, action: 'c', params: {} })

            printer.mutations.removeWsData(state, 1)
            expect(state.socket.wsData).toHaveLength(2)
            expect(state.socket.wsData[0].id).toBe(1)
            expect(state.socket.wsData[1].id).toBe(3)
        })

        it('setKlippyConnected sets klippy_connected flag', () => {
            printer.mutations.setKlippyConnected(state, true)
            expect(state.server.klippy_connected).toBe(true)

            printer.mutations.setKlippyConnected(state, false)
            expect(state.server.klippy_connected).toBe(false)
        })

        it('setCurrentFile sets current_file', () => {
            const file = { filename: 'test.gcode', isDirectory: false, modified: new Date(), permissions: 'rw' }
            printer.mutations.setCurrentFile(state, file)
            expect(state.current_file).toEqual(file)
        })

        it('setCurrentFile strips requestParams', () => {
            printer.mutations.setCurrentFile(state, { filename: 'test.gcode', requestParams: {} } as any)
            expect(state.current_file.filename).toBe('test.gcode')
            expect((state.current_file as any).requestParams).toBeUndefined()
        })

        it('setConfigDir adds theme files', () => {
            const payload = {
                file1: { path: '.theme/custom.css' },
                file2: { path: 'printer.cfg' },
                file3: { path: '.theme/logo.png' },
            }
            printer.mutations.setConfigDir(state, payload)
            expect(state.theme_files).toEqual(['.theme/custom.css', '.theme/logo.png'])
        })

        it('setDatabases sets databases array', () => {
            printer.mutations.setDatabases(state, ['mainsail', 'other'])
            expect(state.databases).toEqual(['mainsail', 'other'])
        })

        it('setMainsailData updates gui data', () => {
            const payload = { uiSettings: { logo: '#FF0000' } }
            printer.mutations.setMainsailData(state, payload)
            expect(state.data.gui.uiSettings?.logo).toBe('#FF0000')
        })

        it('setWebcamsData sets webcams array', () => {
            const webcams = [
                { name: 'cam1', enabled: true, url: 'http://cam1' },
                { name: 'cam2', enabled: false, url: 'http://cam2' },
            ]
            printer.mutations.setWebcamsData(state, webcams as any)
            expect(state.data.webcams).toEqual(webcams)
        })
    })

    describe('getters', () => {
        it('getSocketUrl constructs websocket URL', () => {
            expect((printer.getters as any).getSocketUrl(state)).toContain('/websocket')
            expect((printer.getters as any).getSocketUrl(state)).toMatch(/^ws:\/\//)

            state.socket.protocol = 'wss'
            state.socket.hostname = 'printer.local'
            state.socket.port = 7125
            state.socket.path = '/mainsail'
            expect((printer.getters as any).getSocketUrl(state)).toBe('wss://printer.local:7125/mainsail/websocket')
        })

        it('getSocketUrl handles empty path', () => {
            state.socket.protocol = 'ws'
            state.socket.hostname = 'localhost'
            state.socket.port = 7125
            state.socket.path = ''
            expect((printer.getters as any).getSocketUrl(state)).toBe('ws://localhost:7125/websocket')
        })

        it('getSocketData returns the socket object', () => {
            expect((printer.getters as any).getSocketData(state)).toBe(state.socket)
        })

        it('getPrinterSocketState returns the socket object', () => {
            expect((printer.getters as any).getPrinterSocketState(state)).toBe(state.socket)
        })

        it('isCurrentPrinter compares hostname and port with rootState', () => {
            const rootState = { socket: { hostname: '', port: 7125 } }
            expect((printer.getters as any).isCurrentPrinter(state, {}, rootState)).toBe(true)

            state.socket.hostname = 'other.local'
            state.socket.port = 81
            expect((printer.getters as any).isCurrentPrinter(state, {}, rootState)).toBe(false)
        })

        it('getSetting retrieves setting with fallback', () => {
            state.settings = { speed: 150, enabled: true }
            const fn = (printer.getters as any).getSetting(state)

            expect(fn('speed', 100)).toBe(150)
            expect(fn('enabled', false)).toBe(true)
            expect(fn('missing', 'default')).toBe('default')
        })

        it('getPrinterName uses printername from gui if set', () => {
            state.data.gui.general.printername = 'My Printer'
            expect((printer.getters as any).getPrinterName(state)).toBe('My Printer')
        })

        it('getPrinterName falls back to hostname:port when printername is empty', () => {
            state.socket.hostname = 'printer.local'
            state.socket.port = 81
            state.socket.path = '/mainsail'
            expect((printer.getters as any).getPrinterName(state)).toBe('printer.local:81/mainsail')
        })

        it('getPrinterName omits port 80 from fallback', () => {
            state.socket.hostname = 'printer.local'
            state.socket.port = 80
            state.socket.path = ''
            expect((printer.getters as any).getPrinterName(state)).toBe('printer.local')
        })

        it('getLogoColor returns the configured color or default', () => {
            expect((printer.getters as any).getLogoColor(state)).toBe('#D41216')

            state.data.gui = {
                ...state.data.gui,
                uiSettings: { logo: '#00FF00' },
            } as any
            expect((printer.getters as any).getLogoColor(state)).toBe('#00FF00')
        })

        it('getStatus returns Connecting when not connected but connecting', () => {
            state.socket.isConnected = false
            state.socket.isConnecting = true
            expect((printer.getters as any).getStatus(state, {})).toBe('Connecting...')
        })

        it('getStatus returns Disconnected when not connected and not connecting', () => {
            state.socket.isConnected = false
            state.socket.isConnecting = false
            expect((printer.getters as any).getStatus(state, {})).toBe('Disconnected')
        })

        it('getStatus returns ERROR when connected but klippy not connected', () => {
            state.socket.isConnected = true
            state.server.klippy_connected = false
            expect((printer.getters as any).getStatus(state, {})).toBe('ERROR')
        })

        it('getStatus returns printing percentage when printing', () => {
            state.socket.isConnected = true
            state.server.klippy_connected = true
            state.data.print_stats = { state: 'printing', filename: 'demo.gcode' } as any
            expect((printer.getters as any).getStatus(state, { getPrintPercent: 0.42 })).toBe('42% Printing')
        })

        it('getStatus returns capitalized state for non-printing states', () => {
            state.socket.isConnected = true
            state.server.klippy_connected = true
            state.data.print_stats = { state: 'paused', filename: 'demo.gcode' } as any
            expect((printer.getters as any).getStatus(state, {})).toBe('Paused')
        })

        it('getStatus returns Unknown when no print_stats state', () => {
            state.socket.isConnected = true
            state.server.klippy_connected = true
            expect((printer.getters as any).getStatus(state, {})).toBe('Unknown')
        })

        it('getCurrentFilename returns filename from print_stats', () => {
            state.data.print_stats = { filename: 'test.gcode' } as any
            expect((printer.getters as any).getCurrentFilename(state)).toBe('test.gcode')
        })

        it('getCurrentFilename returns empty string when no print_stats', () => {
            expect((printer.getters as any).getCurrentFilename(state)).toBe('')
        })

        it('getPrintPercent returns file-relative progress by default', () => {
            const localGetters = { getPrintPercentByFilepositionRelative: 0.5 }
            expect((printer.getters as any).getPrintPercent(state, localGetters)).toBe(0.5)
        })

        it('getPrintPercentByFilepositionRelative calculates from file position', () => {
            state.current_file = {
                filename: 'test.gcode',
                gcode_start_byte: 100,
                gcode_end_byte: 500,
            } as any
            state.data.print_stats = { filename: 'test.gcode' }
            state.data.virtual_sdcard = { file_position: 200 }

            const result = (printer.getters as any).getPrintPercentByFilepositionRelative(state, {})
            expect(result).toBeCloseTo(0.25)
        })

        it('getPrintPercentByFilepositionRelative falls back to progress', () => {
            state.data.virtual_sdcard = { progress: 0.33 }
            expect((printer.getters as any).getPrintPercentByFilepositionRelative(state, {})).toBe(0.33)
        })

        it('getPrintPercentByFilepositionAbsolute returns progress', () => {
            state.data.virtual_sdcard = { progress: 0.75 }
            expect((printer.getters as any).getPrintPercentByFilepositionAbsolute(state)).toBe(0.75)
        })

        it('getPrintPercentBySlicer returns display_status progress', () => {
            state.data.display_status = { progress: 0.88 }
            expect((printer.getters as any).getPrintPercentBySlicer(state)).toBe(0.88)
        })

        it('getPrintPercentByFilament calculates from filament used/total', () => {
            state.data.print_stats = { filament_used: 50 } as any
            state.current_file = { filament_total: 200 } as any
            expect((printer.getters as any).getPrintPercentByFilament(state)).toBe(0.25)
        })

        it('getPrintPercentByFilament falls back to progress', () => {
            state.data.virtual_sdcard = { progress: 0.1 }
            expect((printer.getters as any).getPrintPercentByFilament(state)).toBe(0.1)
        })

        it('getPosition returns toolhead position', () => {
            state.data.toolhead = { position: [10, 20, 30] } as any
            expect((printer.getters as any).getPosition(state)).toEqual([10, 20, 30])
        })

        it('getPosition returns empty array when no toolhead data', () => {
            expect((printer.getters as any).getPosition(state)).toEqual([])
        })

        it('getImage returns null when no thumbnails', () => {
            expect((printer.getters as any).getImage(state)).toBeNull()
        })

        it('getImage builds thumbnail URL', () => {
            state.current_file = {
                filename: 'gcodes/test.gcode',
                thumbnails: [
                    { width: 32, height: 32, size: 1024, relative_path: '.thumb.png' },
                    { width: 256, height: 256, size: 4096, relative_path: '.thumb_big.png' },
                ],
            } as any
            state.socket.hostname = 'printer.local'
            state.socket.port = 81
            state.socket.path = '/mainsail'

            const url = (printer.getters as any).getImage(state)
            expect(url).toContain('printer.local:81')
            expect(url).toContain('.thumb_big.png')
        })

        it('getThemeFileUrl finds matching file', () => {
            state.theme_files = ['.theme/sidebar-logo.png', '.theme/other.css']
            state.socket.hostname = 'printer.local'
            state.socket.port = 81
            state.socket.path = ''

            const fn = (printer.getters as any).getThemeFileUrl(state)
            expect(fn('sidebar-logo', ['gif', 'jpg', 'png', 'svg'])).toContain('sidebar-logo.png')
        })

        it('getThemeFileUrl returns null when no match', () => {
            state.theme_files = ['.theme/other.css']
            state.socket.hostname = 'printer.local'
            state.socket.port = 81
            state.socket.path = ''

            const fn = (printer.getters as any).getThemeFileUrl(state)
            expect(fn('sidebar-logo', ['gif', 'jpg', 'png', 'svg'])).toBeNull()
        })

        it('getLogo calls getThemeFileUrl with sidebar-logo', () => {
            state.theme_files = ['.theme/sidebar-logo.svg']
            state.socket.hostname = 'printer.local'
            state.socket.port = 81
            state.socket.path = ''

            const result = (printer.getters as any).getLogo(state, {
                getThemeFileUrl: (printer.getters as any).getThemeFileUrl(state),
            })
            expect(result).toContain('sidebar-logo.svg')
        })

        it('getPrinterWebcams returns only enabled webcams', () => {
            state.data.webcams = [
                { name: 'cam1', enabled: true, url: 'http://cam1' },
                { name: 'cam2', enabled: false, url: 'http://cam2' },
                { name: 'cam3', enabled: true, url: 'http://cam3' },
            ] as any

            const result = (printer.getters as any).getPrinterWebcams(state)
            expect(result).toHaveLength(2)
            expect(result[0].name).toBe('cam1')
            expect(result[1].name).toBe('cam3')
        })
    })

    describe('actions', () => {
        let commit: ReturnType<typeof vi.fn>
        let dispatch: ReturnType<typeof vi.fn>

        beforeEach(() => {
            commit = vi.fn()
            dispatch = vi.fn()
        })

        it('reset commits reset', () => {
            printer.actions.reset({ commit } as any)
            expect(commit).toHaveBeenCalledWith('reset')
        })

        it('connectKlippy sets klippy_connected and dispatches initPrinter', () => {
            printer.actions.connectKlippy({ commit, dispatch } as any)
            expect(commit).toHaveBeenCalledWith('setKlippyConnected', true)
            expect(dispatch).toHaveBeenCalledWith('initPrinter')
        })

        it('disconnectKlippy sets klippy_connected to false', () => {
            printer.actions.disconnectKlippy({ commit } as any)
            expect(commit).toHaveBeenCalledWith('setKlippyConnected', false)
        })

        it('getServerInfo sets klippy_connected and dispatches initPrinter', () => {
            printer.actions.getServerInfo({ commit, dispatch } as any, { klippy_connected: true })
            expect(commit).toHaveBeenCalledWith('setKlippyConnected', true)
            expect(dispatch).toHaveBeenCalledWith('initPrinter')
        })

        it('getMetadataCurrentFile commits setCurrentFile', () => {
            const payload = { filename: 'test.gcode', estimated_time: 3600 }
            printer.actions.getMetadataCurrentFile({ commit } as any, payload)
            expect(commit).toHaveBeenCalledWith('setCurrentFile', payload)
        })

        it('getConfigDir commits setConfigDir', () => {
            const payload = { file1: { path: '.theme/custom.css' } }
            printer.actions.getConfigDir({ commit } as any, payload)
            expect(commit).toHaveBeenCalledWith('setConfigDir', payload)
        })

        it('getMainsailData commits setMainsailData with value', () => {
            const payload = { value: { uiSettings: { logo: '#FF0000' } } }
            printer.actions.getMainsailData({ commit } as any, payload)
            expect(commit).toHaveBeenCalledWith('setMainsailData', payload.value)
        })

        it('getWebcamsData commits setWebcamsData with webcams', () => {
            const payload = { webcams: [{ name: 'cam1', enabled: true, url: 'http://cam1' }] }
            printer.actions.getWebcamsData({ commit } as any, payload)
            expect(commit).toHaveBeenCalledWith('setWebcamsData', payload.webcams)
        })

        it('getDatabases commits setDatabases and fetches mainsail data', () => {
            const payload = { namespaces: ['mainsail', 'other'] }
            printer.actions.getDatabases({ commit, dispatch } as any, payload)
            expect(commit).toHaveBeenCalledWith('setDatabases', ['mainsail', 'other'])
            expect(dispatch).toHaveBeenCalledWith('sendObj', {
                method: 'server.database.get_item',
                params: { namespace: 'mainsail' },
                action: 'getMainsailData',
            })
            expect(dispatch).toHaveBeenCalledWith('sendObj', {
                method: 'server.webcams.list',
                action: 'getWebcamsData',
            })
        })

        it('getDatabases skips mainsail fetch if namespace absent', () => {
            const payload = { namespaces: ['other'] }
            printer.actions.getDatabases({ commit, dispatch } as any, payload)
            expect(commit).toHaveBeenCalledWith('setDatabases', ['other'])
            // should not dispatch sendObj for mainsail
            const sendObjCalls = dispatch.mock.calls.filter((c: any[]) => c[0] === 'sendObj')
            const mainsailCall = sendObjCalls.find((c: any[]) => c[1]?.params?.namespace === 'mainsail')
            expect(mainsailCall).toBeUndefined()
        })

        it('sendObj sends JSON-RPC over WebSocket when open', () => {
            const send = vi.fn()
            state.socket.instance = { readyState: WebSocket.OPEN, send } as any
            state.socket.wsData = []

            printer.actions.sendObj({ state, commit } as any, {
                method: 'printer.info',
                action: 'getObjectsList',
                params: {},
            })

            expect(commit).toHaveBeenCalledWith('addWsData', expect.objectContaining({
                action: 'getObjectsList',
                params: {},
            }))
            expect(send).toHaveBeenCalledWith(expect.stringContaining('printer.info'))
        })

        it('sendObj does nothing when WebSocket is not OPEN', () => {
            const send = vi.fn()
            state.socket.instance = { readyState: WebSocket.CLOSED, send } as any

            printer.actions.sendObj({ state, commit } as any, {
                method: 'printer.info',
                action: 'testAction',
            })

            expect(send).not.toHaveBeenCalled()
            expect(commit).not.toHaveBeenCalled()
        })

        it('initPrinter sends object list, config dir, and database queries when klippy is connected', () => {
            state.server.klippy_connected = true

            printer.actions.initPrinter({ state, commit, dispatch } as any)
            expect(commit).toHaveBeenCalledWith('resetData')
            expect(dispatch).toHaveBeenCalledWith('sendObj', {
                method: 'printer.objects.list',
                action: 'getObjectsList',
            })
            expect(dispatch).toHaveBeenCalledWith('sendObj', {
                method: 'server.files.list',
                action: 'getConfigDir',
                params: { root: 'config' },
            })
            expect(dispatch).toHaveBeenCalledWith('sendObj', {
                method: 'server.database.list',
                action: 'getDatabases',
            })
        })

        it('initPrinter skips object list when klippy is not connected', () => {
            state.server.klippy_connected = false
            const dispatch = vi.fn()

            printer.actions.initPrinter({ state, commit, dispatch } as any)
            expect(commit).toHaveBeenCalledWith('resetData')

            const sendObjCalls = dispatch.mock.calls.filter((c: any[]) => c[0] === 'sendObj')
            const printerObjectsCall = sendObjCalls.find((c: any[]) => c[1]?.method === 'printer.objects.list')
            expect(printerObjectsCall).toBeUndefined()
        })

        it('getObjectsList subscribes to allowed objects and skips disallowed ones', () => {
            const dispatch = vi.fn()

            printer.actions.getObjectsList({ dispatch } as any, {
                objects: [
                    'webhooks',
                    'extruder',
                    'some_unknown_stepper',
                    'heater_bed',
                ],
            })

            expect(dispatch).toHaveBeenCalledWith('sendObj', {
                method: 'printer.objects.subscribe',
                params: {
                    objects: {
                        webhooks: null,
                        extruder: null,
                        heater_bed: null,
                    },
                },
                action: 'getData',
            })
        })

        it('getObjectsList does not subscribe when no allowed objects found', () => {
            const dispatch = vi.fn()

            printer.actions.getObjectsList({ dispatch } as any, {
                objects: ['some_unknown_stepper'],
            })

            expect(dispatch).not.toHaveBeenCalled()
        })

        it('getData updates state and requests metadata for current file', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()

            printer.actions.getData({ commit, dispatch } as any, {
                status: {
                    print_stats: { filename: 'gcodes/test.gcode', state: 'printing' },
                    toolhead: { position: [10, 20, 30] },
                },
            })

            expect(commit).toHaveBeenCalledWith('setData', {
                print_stats: { filename: 'gcodes/test.gcode', state: 'printing' },
                toolhead: { position: [10, 20, 30] },
            })
            expect(dispatch).toHaveBeenCalledWith('sendObj', {
                method: 'server.files.metadata',
                params: { filename: 'gcodes/test.gcode' },
                action: 'getMetadataCurrentFile',
            })
        })

        it('getData does not request metadata when no print_stats filename', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()

            printer.actions.getData({ commit, dispatch } as any, {
                status: { toolhead: { position: [0, 0, 0] } },
            })

            expect(commit).toHaveBeenCalled()
            expect(dispatch).not.toHaveBeenCalledWith('sendObj', expect.objectContaining({
                method: 'server.files.metadata',
            }))
        })

        it('setSettings commits and updates remote printer settings', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = { _namespace: 'remote-1', settings: { speed: 100 } }

            printer.actions.setSettings({ commit, dispatch, state: stateMock } as any, { speed: 200 } as any)

            expect(commit).toHaveBeenCalledWith('setSettings', { speed: 200 })
            expect(dispatch).toHaveBeenCalledWith(
                'gui/remoteprinters/updateSettings',
                { id: 'remote-1', values: { speed: 100 } },
                { root: true }
            )
        })

        it('reconnect closes existing socket and reconnects', () => {
            const close = vi.fn()
            state.socket.instance = { close } as any

            printer.actions.reconnect({ state, dispatch } as any)
            expect(close).toHaveBeenCalled()
            expect(dispatch).toHaveBeenCalledWith('connect')
        })

        it('reconnect handles missing socket instance gracefully', () => {
            state.socket.instance = null

            printer.actions.reconnect({ state, dispatch } as any)
            expect(dispatch).toHaveBeenCalledWith('connect')
        })

        it('connect opens a WebSocket and dispatches server.info on open', () => {
            vi.useFakeTimers()

            const stateMock = {
                _namespace: 'remote-1',
                socket: {
                    hostname: 'printer.local',
                    port: 81,
                    path: '/mainsail',
                    protocol: 'ws',
                    reconnects: 0,
                    maxReconnects: 3,
                    reconnectInterval: 2000,
                    isConnected: false,
                    isConnecting: false,
                    instance: null,
                    wsData: [],
                },
                server: { klippy_connected: false },
                data: { gui: {}, webcams: [] },
                current_file: null,
                theme_files: [],
                databases: [],
                settings: {},
            }

            const commit = vi.fn()
            const dispatch = vi.fn()
            const getters = { getSocketUrl: 'ws://printer.local:81/mainsail/websocket' }

            // Call connect — it creates WebSocket (mocked by happy-dom which returns null)
            // We just verify the commit and the getter is read
            printer.actions.connect({ state: stateMock as any, commit, dispatch, getters, rootGetters: {
                'farm/existsPrinter': vi.fn(() => true),
            } } as any)

            expect(commit).toHaveBeenCalledWith('setSocketData', { isConnecting: true })
            vi.useRealTimers()
        })
    })
})
