/**
 * Mock Vuex store factory for testing
 *
 * Creates a mock Vuex store with customizable state, getters, actions, and mutations.
 * Useful for testing components and composables that depend on Vuex.
 */

import { createStore, Store } from 'vuex'
import { vi } from 'vitest'

export interface MockStoreOptions {
    state?: Record<string, any>
    getters?: Record<string, any>
    actions?: Record<string, any>
    mutations?: Record<string, any>
    modules?: Record<string, any>
}

/**
 * Creates a mock Vuex store with sensible defaults for testing
 */
export function createMockStore(options: MockStoreOptions = {}): Store<any> {
    const defaultState = {
        socket: {
            hostname: 'localhost',
            port: 8080,
            path: '',
            protocol: 'ws',
            isConnected: false,
            isConnecting: false,
            connectingFailed: false,
            connectionFailedMessage: null,
            loadings: [],
            initializationList: ['server'],
            connection_id: null,
        },
        server: {
            klippy_state: 'ready',
            klippy_connected: true,
            components: ['history', 'power'],
            registered_directories: ['gcodes', 'config'],
            config: {
                config: {},
            },
        },
        printer: {
            app_name: 'Klipper',
            print_stats: {
                state: 'ready',
            },
            idle_timeout: {
                state: 'Idle',
            },
            toolhead: {
                homed_axes: 'xyz',
            },
            gcode_move: {
                absolute_coordinates: true,
            },
            configfile: {
                settings: {},
            },
            gcode: {
                commands: {},
            },
        },
        gui: {
            general: {
                printername: 'Test Printer',
                language: 'en',
                dateFormat: null,
                timeFormat: null,
            },
            control: {
                style: 'bars',
                actionButton: null,
                enableXYHoming: false,
                feedrateXY: 100,
                feedrateZ: 25,
                stepsXY: [100, 10, 1],
                stepsZ: [25, 1, 0.1],
            },
            uiSettings: {
                mode: 'dark',
                boolWebcamNavi: false,
                powerDeviceName: null,
            },
            navigationSettings: {
                entries: [],
            },
        },
        files: {
            filetree: [],
            upload: {
                show: false,
                filename: '',
                currentNumber: 0,
                maxNumber: 0,
                cancelTokenSource: null,
                percent: 0,
                speed: 0,
            },
        },
        instancesDB: 'moonraker',
    }

    const defaultGetters = {
        'socket/getUrl': () => '//localhost:8080',
        'socket/getHostUrl': () => 'http://localhost/',
        'socket/getWebsocketUrl': () => 'ws://localhost:8080/websocket',
        'gui/theme': () => 'mainsail',
        'gui/getTheme': () => ({ name: 'mainsail' }),
        'gui/getHours12Format': () => false,
        'gui/getDefaultControlActionButton': () => 'homeAll',
        'printer/existsQGL': () => false,
        'printer/existsZtilt': () => false,
        'printer/existsDeltaCalibrate': () => false,
        'printer/existsScrewsTilt': () => false,
        'printer/existsFirmwareRetraction': () => false,
        'printer/getMacros': () => [],
        'server/power/getDevices': () => [],
        'files/getCustomNaviPoints': () => null,
        'files/getSidebarLogo': () => '',
        'files/getMainBackground': () => null,
        'files/getDirectory': () => () => null,
        'farm/countPrinters': () => 0,
        'gui/webcams/getWebcams': () => [],
    }

    const defaultActions = {
        'server/addEvent': vi.fn(),
        'socket/connect': vi.fn(),
        'socket/disconnect': vi.fn(),
    }

    const defaultMutations = {
        'socket/setConnected': vi.fn(),
        'socket/setDisconnected': vi.fn(),
    }

    const state = { ...defaultState, ...options.state }
    const getters = { ...defaultGetters, ...options.getters }
    const actions = { ...defaultActions, ...options.actions }
    const mutations = { ...defaultMutations, ...options.mutations }

    return createStore({
        state,
        getters,
        actions,
        mutations,
        modules: options.modules || {},
    })
}

/**
 * Creates a minimal mock store for testing composables
 */
export function createMinimalMockStore(
    stateOverrides: Record<string, any> = {},
    getterOverrides: Record<string, any> = {}
): Store<any> {
    return createMockStore({
        state: stateOverrides,
        getters: getterOverrides,
    })
}

/**
 * Creates a mock store with specific socket state
 */
export function createSocketMockStore(
    isConnected: boolean = false,
    hostname: string = 'localhost',
    port: number = 8080
): Store<any> {
    return createMockStore({
        state: {
            socket: {
                hostname,
                port,
                path: '',
                protocol: 'ws',
                isConnected,
                isConnecting: false,
                connectingFailed: false,
                connectionFailedMessage: null,
                loadings: [],
                initializationList: isConnected ? [] : ['server'],
                connection_id: isConnected ? 12345 : null,
            },
        },
    })
}

/**
 * Creates a mock store with specific printer state
 */
export function createPrinterMockStore(klippyState: string = 'ready', printState: string = 'ready'): Store<any> {
    return createMockStore({
        state: {
            server: {
                klippy_state: klippyState,
                klippy_connected: klippyState !== 'disconnected',
                components: ['history', 'power'],
                registered_directories: ['gcodes', 'config'],
            },
            printer: {
                app_name: 'Klipper',
                print_stats: {
                    state: printState,
                },
                idle_timeout: {
                    state: 'Idle',
                },
                toolhead: {
                    homed_axes: 'xyz',
                },
            },
        },
    })
}
