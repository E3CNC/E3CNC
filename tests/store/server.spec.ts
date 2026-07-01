import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getters } from '@/store/server/getters'
import { mutations } from '@/store/server/mutations'
import { actions } from '@/store/server/actions'
import { getDefaultState } from '@/store/server/index'
import type { ServerState } from '@/store/server/types'

const mockSocket = vi.hoisted(() => ({
    emit: vi.fn(),
    emitAndWait: vi.fn(),
}))
const mockToast = vi.hoisted(() => ({
    error: vi.fn(),
    success: vi.fn(),
}))
const mockRouter = vi.hoisted(() => ({
    currentRoute: {
        path: '/printer',
    },
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => mockSocket,
    $toast: mockToast,
}))

vi.mock('@/plugins/router', () => ({
    default: mockRouter,
}))

vi.mock('@/plugins/helpers', () => ({
    camelize: (value: string) => value.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
    formatConsoleMessage: (message: string) => `fmt:${message}`,
    formatFilesize: (bytes: number) => `FS:${bytes}`,
}))

vi.mock('@/store/variables', () => ({
    initableServerComponents: ['power', 'sensor'],
    maxEventHistory: 2,
}))

describe('server store', () => {
    let state: ServerState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    it('formats console events and inserts the helper tip banner', () => {
        state.events = [
            {
                date: new Date('2024-01-01T00:00:00Z'),
                message: 'ok',
                formatMessage: 'fmt:ok',
                type: 'command',
            },
        ]

        const result = (getters as any).getConsoleEvents(state)(false)

        expect(result).toHaveLength(2)
        expect(result[0].message).toContain('Type <a class="command text--blue">HELP</a>')
        expect(result[1].formatMessage).toBe('fmt:ok')
    })

    it('derives host stats, network interfaces, and throttled flags', () => {
        state.system_info = {
            available_services: [],
            cpu_info: {
                bits: '64',
                cpu_count: 2,
                cpu_desc: 'ARM Cortex',
                serial_number: '1',
                hardware_desc: 'board',
                memory_units: 'KB',
                model: 'test',
                processor: 'RPi',
                total_memory: 2,
            },
            distribution: {
                codename: 'noble',
                id: 'ubuntu',
                like: 'debian',
                name: 'Ubuntu',
                version: '24.04',
                version_parts: {
                    build_number: '1',
                    major: '24',
                    minor: '04',
                },
                release_info: {
                    name: 'Ubuntu',
                    version_id: '24.04',
                    id: 'ubuntu',
                },
            },
            sd_info: {
                capacity: '',
                manufacturer: '',
                manufacturer_date: '',
                manufacturer_id: '',
                oem_id: '',
                product_name: '',
                product_revision: '',
                serial_number: '',
                total_bytes: 0,
            },
            service_state: {},
            python: {
                version: ['3'],
                version_string: '3.11.2 (main)',
            },
            network: {
                eth0: {
                    mac_address: 'aa:bb',
                    ip_addresses: [],
                },
            },
            system_uptime: 10,
            instance_ids: {
                moonraker: 'm',
                klipper: 'k',
            },
        }
        state.cpu_temp = 44
        state.system_cpu_usage = { cpu: 12.6 }
        state.network_stats = {
            lo: { bandwidth: 1, rx_bytes: 1, tx_bytes: 1 },
            eth0: { bandwidth: 100, rx_bytes: 10, tx_bytes: 20 },
            can0: { bandwidth: 50, rx_bytes: 5, tx_bytes: 6 },
            wlan0: { bandwidth: 25, rx_bytes: 3, tx_bytes: 4 },
        }
        state.throttled_state = {
            bits: 3,
            flags: ['?', 'under-voltage'],
        }

        const hostStats = (getters as any).getHostStats(
            state,
            {},
            {
                printer: {
                    app_name: 'Klipper',
                    software_version: 'v1-2-3-4-5',
                    system_stats: {
                        sysload: 1.8,
                        memavail: 1,
                    },
                },
            },
            {
                'printer/getHostTempSensor': null,
            }
        )

        expect(hostStats.version).toBe('Klipper v1-2-3-4')
        expect(hostStats.pythonVersion).toBe('3.11.2 ')
        expect(hostStats.loadPercent).toBe(90)
        expect(hostStats.loadProgressColor).toBe('warning')
        expect(hostStats.memoryFormat).toBe('FS:1024 / FS:2048')
        expect(hostStats.memUsage).toBe(50)
        expect(hostStats.tempSensor.temperature).toBe('44')

        expect((getters as any).getCpuUsage(state)).toBe(13)
        expect((getters as any).getThrottledStateFlags(state)).toEqual(['Undervoltage'])
        expect((getters as any).getNetworkInterfaces(state)).toEqual({
            eth0: {
                bandwidth: 100,
                rx_bytes: 10,
                tx_bytes: 20,
                details: {
                    mac_address: 'aa:bb',
                    ip_addresses: [],
                },
            },
            can0: {
                bandwidth: 50,
                rx_bytes: 5,
                tx_bytes: 6,
            },
        })
    })

    it('applies mutations for gcode store and events', () => {
        mutations.setData(state, { klippy_state: 'ready', websocket_count: 2 } as any)
        expect(state.klippy_state).toBe('ready')
        expect(state.websocket_count).toBe(2)

        mutations.setGcodeStore(state, [
            { time: 1, type: 'response', message: '// debug: drop me' },
            { time: 2, type: 'command', message: 'G28' },
            { time: 3, type: 'response', message: 'ok' },
        ] as any)
        expect(state.events).toHaveLength(2)
        expect(state.events[0].type).toBe('command')
        expect(state.events[1].type).toBe('response')

        mutations.addEvent(state, {
            date: new Date('2024-01-01T00:00:00Z'),
            message: 'M117 Hi',
            formatMessage: 'fmt:M117 Hi',
            type: 'autocomplete',
        })
        mutations.addEvent(state, {
            date: new Date('2024-01-01T00:00:01Z'),
            message: 'M117 Hi',
            formatMessage: 'fmt:M117 Hi',
            type: 'command',
        })

        expect(state.events.at(-1)?.type).toBe('command')
        expect(state.events).toHaveLength(2)

        mutations.addFailedInitComponent(state, 'power')
        mutations.addFailedInitComponent(state, 'power')
        mutations.removeComponent(state, 'power')
        expect(state.failed_init_components).toEqual(['power'])
        expect(state.components).toEqual([])
    })

    it('filters and routes server actions', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        actions.addEvent({ commit, rootGetters: { 'gui/console/getConsolefilterRules': [] } } as any, {
            message: '!! boom',
            type: 'response',
        })
        expect(commit).toHaveBeenCalledWith(
            'addEvent',
            expect.objectContaining({
                message: '!! boom',
                type: 'response',
            })
        )
        expect(mockToast.error).toHaveBeenCalled()

        actions.getGcodeStore(
            {
                commit,
                dispatch,
                rootGetters: {
                    'gui/console/getConsolefilterRules': ['skip'],
                    'gui/console/getConsoleClearedSince': 2000,
                },
            } as any,
            {
                gcode_store: [
                    { time: 1, type: 'response', message: 'old' },
                    { time: 3, type: 'response', message: 'skip me' },
                    { time: 4, type: 'response', message: 'keep me' },
                ],
            }
        )

        expect(commit).toHaveBeenCalledWith('clearGcodeStore')
        expect(commit).toHaveBeenCalledWith('setGcodeStore', [{ time: 4, type: 'response', message: 'keep me' }])
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/gcode_store', { root: true })
    })

    it('addEvent catches invalid regex filters and logs error', () => {
        const consoleSpy = vi.spyOn(window.console, 'error').mockImplementation(() => {})
        const commit = vi.fn()
        actions.addEvent({ commit, rootGetters: { 'gui/console/getConsolefilterRules': ['[invalid'] } } as any, {
            message: 'test message',
            type: 'response',
        })
        expect(consoleSpy).toHaveBeenCalledWith("Custom console filter '[invalid' doesn't work!")
        expect(commit).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it('getGcodeStore passes when cleared_since is falsy', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        actions.getGcodeStore(
            {
                commit,
                dispatch,
                rootGetters: { 'gui/console/getConsolefilterRules': [], 'gui/console/getConsoleClearedSince': 0 },
            } as any,
            {
                gcode_store: [
                    { time: 1, type: 'response', message: 'hello' },
                    { time: 2, type: 'response', message: 'world' },
                ],
            }
        )
        expect(commit).toHaveBeenCalledWith('setGcodeStore', [
            { time: 1, type: 'response', message: 'hello' },
            { time: 2, type: 'response', message: 'world' },
        ])
    })

    it('getGcodeStore catches invalid regex filters', () => {
        const consoleSpy = vi.spyOn(window.console, 'error').mockImplementation(() => {})
        const commit = vi.fn()
        const dispatch = vi.fn()
        actions.getGcodeStore(
            {
                commit,
                dispatch,
                rootGetters: { 'gui/console/getConsolefilterRules': ['[bad'], 'gui/console/getConsoleClearedSince': 0 },
            } as any,
            {
                gcode_store: [{ time: 1, type: 'response', message: 'test' }],
            }
        )
        expect(consoleSpy).toHaveBeenCalledWith("Custom console filter '[bad' doesn't work")
        consoleSpy.mockRestore()
    })

    it('initServerInfo deletes plugins and failed_plugins keys from payload', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const payload: any = {
            components: ['power'],
            registered_directories: ['gcodes'],
            plugins: { somePlugin: {} },
            failed_plugins: ['broken'],
        }
        actions.initServerInfo({ dispatch, commit } as any, payload)
        expect(payload).not.toHaveProperty('plugins')
        expect(payload).not.toHaveProperty('failed_plugins')
        expect(commit).toHaveBeenCalledWith('setData', expect.not.objectContaining({ plugins: expect.anything() }))
    })

    it('initServerInfo handles empty components and registered_directories', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        actions.initServerInfo({ dispatch, commit } as any, {
            components: [],
            registered_directories: [],
            klippy_state: 'ready',
        })
        expect(dispatch).not.toHaveBeenCalledWith(
            'socket/addInitModule',
            expect.stringContaining('server/'),
            expect.anything()
        )
        expect(dispatch).not.toHaveBeenCalledWith('files/initRootDirs', expect.anything(), expect.anything())
        expect(commit).toHaveBeenCalledWith('setData', {
            components: [],
            registered_directories: [],
            klippy_state: 'ready',
        })
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/info', { root: true })
    })

    it('getGcodeStore filters events by date when cleared_since is set', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const now = Date.now()
        actions.getGcodeStore(
            {
                commit,
                dispatch,
                rootGetters: { 'gui/console/getConsolefilterRules': [], 'gui/console/getConsoleClearedSince': now },
            } as any,
            {
                gcode_store: [
                    { time: Math.floor(now / 1000) + 100, type: 'response', message: 'future event' },
                    { type: 'response', message: 'old date event', date: new Date(now - 100000).toISOString() },
                ],
            }
        )
        expect(commit).toHaveBeenCalledWith(
            'setGcodeStore',
            expect.arrayContaining([expect.objectContaining({ message: 'future event' })])
        )
    })

    it('init handles non-Error exception', async () => {
        mockSocket.emitAndWait.mockRejectedValue('string error')
        const commit = vi.fn()
        const dispatch = vi.fn()
        const rootState = { packageVersion: 'v2.14.0' }
        const store = { dispatch }
        const consoleSpy = vi.spyOn(window.console, 'error').mockImplementation(() => {})

        await actions.init.bind(store)({ commit, dispatch, rootState } as any)

        expect(consoleSpy).toHaveBeenCalledWith('Error while identifying client: string error')
        expect(dispatch).not.toHaveBeenCalledWith('socket/setConnectionFailed', expect.anything())
        consoleSpy.mockRestore()
    })

    it('init identifies the client and requests initial server data', async () => {
        mockSocket.emitAndWait.mockResolvedValue({ connection_id: 'abc-123' })
        const commit = vi.fn()
        const dispatch = vi.fn()

        await actions.init({ commit, dispatch, rootState: { packageVersion: '0.7.2' } } as any)

        expect(commit).toHaveBeenCalledWith('setConnectionId', 'abc-123')
        expect(dispatch).toHaveBeenCalledWith('socket/addInitModule', 'server/info', { root: true })
        expect(dispatch).toHaveBeenCalledWith('socket/addInitModule', 'server/databaseList', { root: true })
        expect(mockSocket.emit).toHaveBeenCalledWith('server.info', {}, { action: 'server/initServerInfo' })
        expect(mockSocket.emit).toHaveBeenCalledWith(
            'server.database.list',
            { root: 'config' },
            { action: 'server/checkDatabases' }
        )
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server', { root: true })
    })

    it('init dispatches socket/setConnectionFailed on unauthorized errors', async () => {
        mockSocket.emitAndWait.mockRejectedValue(new Error('Unauthorized'))
        const commit = vi.fn()
        const store = { dispatch: vi.fn() }
        const consoleSpy = vi.spyOn(window.console, 'error').mockImplementation(() => {})

        await actions.init.bind(store)({ commit, dispatch: vi.fn(), rootState: { packageVersion: '0.7.2' } } as any)

        expect(store.dispatch).toHaveBeenCalledWith('socket/setConnectionFailed', 'Unauthorized')
        consoleSpy.mockRestore()
    })

    it('checkDatabases initializes existing namespaces and falls back to initDb for missing ones', () => {
        const dispatch = vi.fn()
        const commit = vi.fn()

        actions.checkDatabases({ dispatch, commit } as any, { namespaces: ['mainsail'] })

        expect(dispatch).toHaveBeenCalledWith('socket/addInitModule', 'gui/init', { root: true })
        expect(dispatch).toHaveBeenCalledWith('gui/init', null, { root: true })
        expect(dispatch).toHaveBeenCalledWith('gui/maintenance/initDb', null, { root: true })
        expect(dispatch).toHaveBeenCalledWith('socket/addInitModule', 'gui/webcam/init', { root: true })
        expect(dispatch).toHaveBeenCalledWith('gui/webcams/init', null, { root: true })
        expect(commit).toHaveBeenCalledWith('saveDbNamespaces', ['mainsail'])
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/databaseList', { root: true })
    })

    it('initProcStats stores throttled state and boot time', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        actions.initProcStats({ commit, dispatch } as any, {
            throttled_state: { bits: 1 },
            system_uptime: 5,
        })

        expect(commit).toHaveBeenCalledWith('setThrottledState', { bits: 1 })
        expect(commit).toHaveBeenCalledWith('setSystemBootAt', expect.any(Date))
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/procStats', { root: true })
    })

    it('updateProcStats commits all supported stat payloads', () => {
        const commit = vi.fn()
        actions.updateProcStats({ commit } as any, {
            cpu_temp: 42,
            moonraker_stats: { cpu_usage: 10 },
            network: { eth0: { rx_bytes: 1 } },
            system_cpu_usage: { cpu: 90 },
        })

        expect(commit).toHaveBeenCalledWith('setCpuTemp', 42)
        expect(commit).toHaveBeenCalledWith('setMoonrakerStats', { cpu_usage: 10 })
        expect(commit).toHaveBeenCalledWith('setNetworkStats', { eth0: { rx_bytes: 1 } })
        expect(commit).toHaveBeenCalledWith('setCpuStats', { cpu: 90 })
    })

    it('setKlippyReady resets intervals and reinitializes the printer', () => {
        const dispatch = vi.fn()
        actions.setKlippyReady({ dispatch } as any)
        expect(dispatch).toHaveBeenCalledWith('stopKlippyConnectedInterval')
        expect(dispatch).toHaveBeenCalledWith('stopKlippyStateInterval')
        expect(dispatch).toHaveBeenCalledWith('printer/reset', null, { root: true })
        expect(dispatch).toHaveBeenCalledWith('printer/init', null, { root: true })
    })

    it('setKlippyDisconnected and setKlippyShutdown update state and restart polling', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        actions.setKlippyDisconnected({ commit, dispatch } as any)
        actions.setKlippyShutdown({ commit, dispatch } as any)

        expect(commit).toHaveBeenCalledWith('setKlippyDisconnected', null)
        expect(commit).toHaveBeenCalledWith('setKlippyShutdown', null)
        expect(dispatch).toHaveBeenCalledWith('stopKlippyStateInterval')
        expect(dispatch).toHaveBeenCalledWith('startKlippyConnectedInterval')
    })

    it('start/stop klippy interval helpers guard against duplicate work', () => {
        vi.useFakeTimers()
        const commit = vi.fn()

        actions.startKlippyConnectedInterval({ commit, state: { klippy_connected_timer: null } } as any)
        expect(commit).toHaveBeenCalledWith('setKlippyConnectedTimer', expect.anything())

        commit.mockClear()
        actions.startKlippyConnectedInterval({ commit, state: { klippy_connected_timer: 123 } } as any)
        expect(commit).not.toHaveBeenCalled()

        actions.stopKlippyConnectedInterval({ commit, state: { klippy_connected_timer: 123 } } as any)
        expect(commit).toHaveBeenCalledWith('setKlippyConnectedTimer', null)

        commit.mockClear()
        actions.stopKlippyStateInterval({ commit, state: { klippy_state_timer: null } } as any)
        expect(commit).not.toHaveBeenCalled()
        vi.useRealTimers()
    })

    it('checkKlippyConnected handles disconnected and connected states', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        actions.checkKlippyConnected({ commit, dispatch } as any, { klippy_connected: false })
        expect(dispatch).toHaveBeenCalledWith('startKlippyConnectedInterval')

        dispatch.mockClear()
        actions.checkKlippyConnected({ commit, dispatch } as any, {
            klippy_connected: true,
            klippy_state: 'ready',
        })
        expect(dispatch).toHaveBeenCalledWith('stopKlippyConnectedInterval')
        expect(commit).toHaveBeenCalledWith('setKlippyConnected')
        expect(dispatch).toHaveBeenCalledWith('printer/initGcodes', null, { root: true })
        expect(dispatch).toHaveBeenCalledWith('checkKlippyState', { state: 'ready', state_message: null })
    })

    it('checkKlippyState polls until ready, then initializes the printer', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        actions.checkKlippyState({ commit, dispatch } as any, { state: 'startup', state_message: 'booting' })
        expect(commit).toHaveBeenCalledWith('setKlippyState', 'startup')
        expect(commit).toHaveBeenCalledWith('setKlippyMessage', 'booting')
        expect(dispatch).toHaveBeenCalledWith('startKlippyStateInterval')

        dispatch.mockClear()
        actions.checkKlippyState({ commit, dispatch } as any, { state: 'ready', state_message: null })
        expect(dispatch).toHaveBeenCalledWith('stopKlippyConnectedInterval')
        expect(dispatch).toHaveBeenCalledWith('stopKlippyStateInterval')
        expect(dispatch).toHaveBeenCalledWith('printer/init', null, { root: true })
    })

    it('addRootDirectory only adds unknown roots', () => {
        const commit = vi.fn()
        actions.addRootDirectory({ commit, state: { registered_directories: ['config'] } } as any, {
            item: { root: 'gcodes' },
        })
        actions.addRootDirectory({ commit, state: { registered_directories: ['config'] } } as any, {
            item: { root: 'config' },
        })

        expect(commit).toHaveBeenCalledTimes(1)
        expect(commit).toHaveBeenCalledWith('addRootDirectory', { name: 'gcodes' })
    })

    it('addEvent classifies action/debug responses and filters matching messages', () => {
        const commit = vi.fn()

        actions.addEvent({ commit, rootGetters: { 'gui/console/getConsolefilterRules': [] } } as any, {
            message: '// action:LEVEL',
            type: 'response',
        })
        actions.addEvent({ commit, rootGetters: { 'gui/console/getConsolefilterRules': [] } } as any, {
            message: '// debug:TRACE',
            type: 'response',
        })
        actions.addEvent({ commit, rootGetters: { 'gui/console/getConsolefilterRules': ['skip'] } } as any, {
            message: 'skip this',
            type: 'response',
        })

        expect(commit).toHaveBeenCalledWith('addEvent', expect.objectContaining({ type: 'action' }))
        expect(commit).toHaveBeenCalledWith('addEvent', expect.objectContaining({ type: 'debug' }))
        expect(commit).not.toHaveBeenCalledWith('addEvent', expect.objectContaining({ message: 'skip this' }))

        // Test payload with result and error formats
        actions.addEvent({ commit, rootGetters: { 'gui/console/getConsolefilterRules': [] } } as any, {
            result: 'ok',
            type: 'response',
        })
        expect(commit).toHaveBeenCalledWith('addEvent', expect.objectContaining({ message: 'ok' }))

        actions.addEvent({ commit, rootGetters: { 'gui/console/getConsolefilterRules': [] } } as any, {
            error: { message: 'fail' },
            type: 'response',
        })
        expect(commit).toHaveBeenCalledWith('addEvent', expect.objectContaining({ message: 'fail' }))
    })

    it('getData commits setData', () => {
        const commit = vi.fn()
        actions.getData({ commit } as any, { klippy_state: 'ready' })
        expect(commit).toHaveBeenCalledWith('setData', { klippy_state: 'ready' })
    })

    it('initServerConfig commits setConfig', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        actions.initServerConfig({ commit, dispatch } as any, { some: 'config' })
        expect(commit).toHaveBeenCalledWith('setConfig', { some: 'config' })
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/config', { root: true })
    })

    it('initSystemInfo commits setSystemInfo', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        actions.initSystemInfo({ commit, dispatch } as any, { system_info: { cpu_count: 4 } })
        expect(commit).toHaveBeenCalledWith('setSystemInfo', { cpu_count: 4 })
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/systemInfo', { root: true })
    })

    it('startKlippyStateInterval and stopKlippyStateInterval guard against duplicates', () => {
        vi.useFakeTimers()
        const commit = vi.fn()

        actions.startKlippyStateInterval({ commit, state: { klippy_state_timer: null } } as any)
        expect(commit).toHaveBeenCalledWith('setKlippyStateTimer', expect.anything())

        commit.mockClear()
        actions.startKlippyStateInterval({ commit, state: { klippy_state_timer: 456 } } as any)
        expect(commit).not.toHaveBeenCalled()

        actions.stopKlippyStateInterval({ commit, state: { klippy_state_timer: 456 } } as any)
        expect(commit).toHaveBeenCalledWith('setKlippyStateTimer', null)
        vi.useRealTimers()
    })

    it('serviceStateChanged and addFailedInitComponent forward commits', () => {
        const commit = vi.fn()
        actions.serviceStateChanged({ commit } as any, { moonraker: 'active' })
        actions.addFailedInitComponent({ commit } as any, 'sensor')

        expect(commit).toHaveBeenCalledWith('updateServiceState', { moonraker: 'active' })
        expect(commit).toHaveBeenCalledWith('removeComponent', 'sensor')
        expect(commit).toHaveBeenCalledWith('addFailedInitComponent', 'sensor')
    })
})

describe('server mutations', () => {
    let state: ServerState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    it('reset restores default state', () => {
        state.cpu_temp = 99
        state.klippy_state = 'printing'
        state.events = [{ date: new Date(), message: 'test', formatMessage: 'test', type: 'response' }]

        mutations.reset(state)
        expect(state.cpu_temp).toBe(0)
        expect(state.klippy_state).toBe('')
        expect(state.events).toEqual([])
    })

    it('setKlippyConnected sets flag to true', () => {
        mutations.setKlippyConnected(state)
        expect(state.klippy_connected).toBe(true)
    })

    it('setKlippyState updates state string', () => {
        mutations.setKlippyState(state, 'printing')
        expect(state.klippy_state).toBe('printing')
    })

    it('setKlippyStateTimer sets timer reference', () => {
        const timer = setInterval(() => {}, 1000)
        mutations.setKlippyStateTimer(state, timer)
        expect(state.klippy_state_timer).toBe(timer)
        clearInterval(timer)
    })

    it('setKlippyMessage sets the message', () => {
        mutations.setKlippyMessage(state, 'Printer is ready')
        expect(state.klippy_message).toBe('Printer is ready')
    })

    it('setKlippyDisconnected resets connection state', () => {
        mutations.setKlippyDisconnected(state)
        expect(state.klippy_connected).toBe(false)
        expect(state.klippy_state).toBe('disconnected')
        expect(state.klippy_message).toBe('Disconnected...')
    })

    it('setKlippyShutdown sets shutdown state', () => {
        mutations.setKlippyShutdown(state)
        expect(state.klippy_state).toBe('shutdown')
        expect(state.klippy_message).toBe('Shutdown...')
    })

    it('setCpuTemp, setMoonrakerStats, setNetworkStats, setCpuStats update their respective fields', () => {
        mutations.setCpuTemp(state, 45)
        expect(state.cpu_temp).toBe(45)

        mutations.setMoonrakerStats(state, { cpu_usage: 12 })
        expect(state.moonraker_stats).toEqual({ cpu_usage: 12 })

        mutations.setNetworkStats(state, { eth0: { rx_bytes: 100 } })
        expect(state.network_stats).toEqual({ eth0: { rx_bytes: 100 } })

        mutations.setCpuStats(state, { cpu: 85 })
        expect(state.system_cpu_usage).toEqual({ cpu: 85 })
    })

    it('setKlippyConnectedTimer sets and clears the timer', () => {
        const timer = setInterval(() => {}, 1000)
        mutations.setKlippyConnectedTimer(state, timer)
        expect(state.klippy_connected_timer).toBe(timer)

        mutations.setKlippyConnectedTimer(state, null)
        expect(state.klippy_connected_timer).toBeNull()
        clearInterval(timer)
    })

    it('setProcStats commits temp and moonraker stats together', () => {
        mutations.setProcStats(state, { cpu_temp: 50, moonraker_stats: { cpu_usage: 8 } })
        expect(state.cpu_temp).toBe(50)
        expect(state.moonraker_stats).toEqual({ cpu_usage: 8 })
    })

    it('setConnectionId stores the connection id', () => {
        mutations.setConnectionId(state, 'conn-123')
        expect(state.connection_id).toBe('conn-123')
    })

    it('setData iterates payload and strips requestParams', () => {
        mutations.setData(state, {
            klippy_state: 'ready',
            websocket_count: 5,
            requestParams: {},
        } as any)

        expect(state.klippy_state).toBe('ready')
        expect(state.websocket_count).toBe(5)
        expect((state as any).requestParams).toBeUndefined()
    })

    it('saveDbNamespaces stores the namespaces array', () => {
        mutations.saveDbNamespaces(state, ['mainsail', 'maintenance'])
        expect(state.dbNamespaces).toEqual(['mainsail', 'maintenance'])
    })

    it('setConfig stores config', () => {
        mutations.setConfig(state, { some: 'config' })
        expect(state.config).toEqual({ some: 'config' })
    })

    it('setConsoleClearedThisSession toggles the flag', () => {
        expect(state.console_cleared_this_session).toBeFalsy()
        mutations.setConsoleClearedThisSession(state)
        expect(state.console_cleared_this_session).toBe(true)
    })

    it('clearGcodeStore empties the events array', () => {
        state.events = [{ date: new Date(), message: 'x', formatMessage: 'x', type: 'command' }]
        mutations.clearGcodeStore(state)
        expect(state.events).toEqual([])
    })

    it('setGcodeStore truncates payloads larger than maxEventHistory', () => {
        const large = Array.from({ length: 200 }, (_, i) => ({
            time: i,
            type: 'response',
            message: `msg-${i}`,
        }))
        mutations.setGcodeStore(state, large)
        expect(state.events.length).toBeLessThanOrEqual(100)
    })

    it('setGcodeStore classifies command messages', () => {
        mutations.setGcodeStore(state, [
            { time: 1, type: 'command', message: 'G28' },
            { time: 2, type: 'response', message: '// action:RESPOND' },
        ])
        expect(state.events[0].type).toBe('command')
        expect(state.events[0].formatMessage).toContain('text--blue')
        expect(state.events[1].type).toBe('action')
    })

    it('addEvent replaces autocomplete with follow-up command', () => {
        state.events = [{ date: new Date(), message: 'prev', formatMessage: 'prev', type: 'autocomplete' }] as any

        mutations.addEvent(state, {
            date: new Date(),
            message: 'G28',
            formatMessage: 'fmt:G28',
            type: 'command',
        })

        expect(state.events).toHaveLength(1)
        expect(state.events[0].message).toBe('G28')
    })

    it('addEvent trims events to maxEventHistory', () => {
        for (let i = 0; i < 200; i++) {
            mutations.addEvent(state, {
                date: new Date(),
                message: `event-${i}`,
                formatMessage: `fmt:event-${i}`,
                type: 'response',
            })
        }
        expect(state.events.length).toBeLessThanOrEqual(100)
    })

    it('setSystemInfo stores system info', () => {
        const info = { cpu_info: { cpu_count: 4 } }
        mutations.setSystemInfo(state, info)
        expect(state.system_info).toEqual(info)
    })

    it('setThrottledState stores bits and flags', () => {
        mutations.setThrottledState(state, { bits: 3, flags: ['?', 'under-voltage'] })
        expect(state.throttled_state.bits).toBe(3)
        expect(state.throttled_state.flags).toEqual(['?', 'under-voltage'])
    })

    it('setThrottledState handles payload without bits/flags gracefully', () => {
        mutations.setThrottledState(state, {})
        expect(state.throttled_state.bits).toBe(0)
        expect(state.throttled_state.flags).toEqual([])
    })

    it('setSystemBootAt stores boot timestamp', () => {
        const date = new Date('2024-01-01')
        mutations.setSystemBootAt(state, date)
        expect(state.system_boot_at).toBe(date)
    })

    it('addRootDirectory appends to registered_directories', () => {
        mutations.addRootDirectory(state, { name: 'gcodes' })
        expect(state.registered_directories).toContain('gcodes')
    })

    it('updateServiceState updates an existing service state', () => {
        state.system_info = { service_state: { moonraker: 'inactive' } } as any
        mutations.updateServiceState(state, { moonraker: 'active' })
        expect((state.system_info as NonNullable<typeof state.system_info>).service_state.moonraker).toBe('active')
    })

    it('addFailedInitComponent prevents duplicates', () => {
        mutations.addFailedInitComponent(state, 'power')
        mutations.addFailedInitComponent(state, 'power')
        expect(state.failed_init_components).toEqual(['power'])
    })

    it('removeComponent only removes if present', () => {
        state.components = ['power', 'sensor']
        mutations.removeComponent(state, 'sensor')
        expect(state.components).toEqual(['power'])

        mutations.removeComponent(state, 'missing')
        expect(state.components).toEqual(['power'])
    })
})
