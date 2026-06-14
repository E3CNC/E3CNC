import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useBase } from '@/composables/useBase'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'

// Mock Vuetify's useDisplay
vi.mock('vuetify', () => ({
    useDisplay: () => ({
        mobile: ref(false),
        smAndUp: ref(true),
        lgAndUp: ref(false),
        xl: ref(false),
    }),
}))

describe('useBase', () => {
    let store: any

    beforeEach(() => {
        store = createStore({
            state: {
                socket: {
                    isConnected: true,
                    initializationList: [],
                    loadings: [],
                    port: 80,
                    hostname: 'localhost',
                },
                server: {
                    klippy_connected: true,
                    klippy_state: 'ready',
                    components: ['test'],
                    registered_directories: ['gcodes'],
                    config: {
                        config: {},
                    },
                },
                printer: {
                    app_name: 'Klipper',
                    print_stats: {
                        state: 'standby',
                    },
                    idle_timeout: {
                        state: 'Idle',
                    },
                },
                gui: {
                    general: {
                        timeFormat: '24hours',
                        dateFormat: 'yyyy-mm-dd',
                    },
                    uiSettings: {
                        powerDeviceName: null,
                    },
                },
                instancesDB: 'moonraker',
            },
            getters: {
                'socket/getUrl': () => 'ws://localhost:80/websocket',
                'socket/getHostUrl': () => 'http://localhost:80',
                'server/power/getDevices': () => [],
                'gui/getHours12Format': () => false,
            },
        })
    })

    function mountComposable() {
        let result: any
        const TestComponent = {
            template: '<div></div>',
            setup() {
                result = useBase()
                return {}
            },
        }
        mount(TestComponent, {
            global: {
                plugins: [store],
            },
        })
        return result
    }

    describe('connection state', () => {
        it('returns socket connection state', () => {
            const base = mountComposable()
            expect(base.socketIsConnected.value).toBe(true)
        })

        it('returns gui ready state when initializationList is empty', () => {
            const base = mountComposable()
            expect(base.guiIsReady.value).toBe(true)
        })

        it('returns gui not ready when initializationList has items', () => {
            store.state.socket.initializationList = ['server']
            const base = mountComposable()
            expect(base.guiIsReady.value).toBe(false)
        })

        it('returns klippy connection state', () => {
            const base = mountComposable()
            expect(base.klippyIsConnected.value).toBe(true)
        })

        it('returns klipper state', () => {
            const base = mountComposable()
            expect(base.klipperState.value).toBe('ready')
        })

        it('returns disconnected when klippy is not connected', () => {
            store.state.server.klippy_connected = false
            const base = mountComposable()
            expect(base.klipperState.value).toBe('disconnected')
        })

        it('returns klipper ready for GUI when connected and ready', () => {
            const base = mountComposable()
            expect(base.klipperReadyForGui.value).toBe(true)
        })
    })

    describe('printer state', () => {
        it('returns printer is not printing when standby', () => {
            const base = mountComposable()
            expect(base.printerIsPrinting.value).toBe(false)
        })

        it('returns printer is printing when printing', () => {
            store.state.printer.print_stats.state = 'printing'
            const base = mountComposable()
            expect(base.printerIsPrinting.value).toBe(true)
        })

        it('returns printer is printing when paused', () => {
            store.state.printer.print_stats.state = 'paused'
            const base = mountComposable()
            expect(base.printerIsPrinting.value).toBe(true)
        })

        it('returns printer is printing only when printing (not paused)', () => {
            store.state.printer.print_stats.state = 'printing'
            const base = mountComposable()
            expect(base.printerIsPrintingOnly.value).toBe(true)
        })

        it('returns printer is not printing only when paused', () => {
            store.state.printer.print_stats.state = 'paused'
            const base = mountComposable()
            expect(base.printerIsPrintingOnly.value).toBe(false)
        })

        it('returns printer state from print_stats', () => {
            const base = mountComposable()
            expect(base.printer_state.value).toBe('standby')
        })

        it('returns klipper app name', () => {
            const base = mountComposable()
            expect(base.klipperAppName.value).toBe('Klipper')
        })
    })

    describe('URLs and ports', () => {
        it('returns API URL', () => {
            const base = mountComposable()
            expect(base.apiUrl.value).toBe('ws://localhost:80/websocket')
        })

        it('returns host URL', () => {
            const base = mountComposable()
            expect(base.hostUrl.value).toBe('http://localhost:80')
        })

        it('returns host port', () => {
            const base = mountComposable()
            expect(base.hostPort.value).toBe(80)
        })

        it('returns instances DB', () => {
            const base = mountComposable()
            expect(base.instancesDB.value).toBe('moonraker')
        })
    })

    describe('device detection', () => {
        it('returns isMobile from display', () => {
            const base = mountComposable()
            expect(base.isMobile.value).toBe(false)
        })

        it('returns viewport', () => {
            const base = mountComposable()
            expect(base.viewport.value).toBe('tablet')
        })

        it('returns moonraker components', () => {
            const base = mountComposable()
            expect(base.moonrakerComponents.value).toEqual(['test'])
        })

        it('returns existGcodesRootDirectory when gcodes exists', () => {
            const base = mountComposable()
            expect(base.existGcodesRootDirectory.value).toBe(true)
        })
    })

    describe('loadings', () => {
        it('returns empty loadings array', () => {
            const base = mountComposable()
            expect(base.loadings.value).toEqual([])
        })

        it('returns loadings array with items', () => {
            store.state.socket.loadings = ['test1', 'test2']
            const base = mountComposable()
            expect(base.loadings.value).toEqual(['test1', 'test2'])
        })
    })

    describe('formatDate', () => {
        it('formats date with default format', () => {
            const base = mountComposable()
            const date = new Date('2026-06-13T12:00:00Z')
            const result = base.formatDate(date)
            // Default format is yyyy-mm-dd from store state
            expect(result).toBe('2026-06-13')
        })

        it('formats date with iso format', () => {
            const base = mountComposable()
            const date = new Date('2026-06-13T12:00:00Z')
            const result = base.formatDate(date, 'iso')
            expect(result).toBe('2026-06-13')
        })

        it('formats date with short format', () => {
            const base = mountComposable()
            const date = new Date('2026-06-13T12:00:00Z')
            const result = base.formatDate(date, 'short')
            expect(result).toBeTruthy()
        })

        it('returns NaN-NaN-NaN for invalid date with custom format', () => {
            const base = mountComposable()
            const result = base.formatDate('invalid')
            // Note: formatDate doesn't catch invalid dates properly, returns NaN-NaN-NaN
            expect(result).toBe('NaN-NaN-NaN')
        })
    })

    describe('formatTime', () => {
        it('formats time without seconds', () => {
            const base = mountComposable()
            const date = new Date('2026-06-13T12:30:45Z')
            const result = base.formatTime(date)
            expect(result).toBeTruthy()
        })

        it('formats time with seconds', () => {
            const base = mountComposable()
            const date = new Date('2026-06-13T12:30:45Z')
            const result = base.formatTime(date, true)
            expect(result).toBeTruthy()
        })

        it('returns Invalid Date for invalid date', () => {
            const base = mountComposable()
            const result = base.formatTime('invalid')
            // Note: formatTime doesn't catch invalid dates properly, returns 'Invalid Date'
            expect(result).toBe('Invalid Date')
        })
    })

    describe('formatDateTime', () => {
        it('formats date and time together', () => {
            const base = mountComposable()
            const timestamp = new Date('2026-06-13T12:30:45Z').getTime()
            const result = base.formatDateTime(timestamp)
            expect(result).toBeTruthy()
            expect(result).toContain('2026')
        })
    })
})
