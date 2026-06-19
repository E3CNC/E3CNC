import { describe, it, expect, beforeEach, vi } from 'vitest'
import { actions } from '@/store/actions'
import { mutations } from '@/store/mutations'
import { getters } from '@/store/getters'
import { getDefaultState } from '@/store/index'
import type { RootState } from '@/store/types'

const mockRouter = vi.hoisted(() => ({
    push: vi.fn(),
    currentRoute: { fullPath: '/' },
}))

vi.mock('@/plugins/router', () => ({
    default: mockRouter,
}))

vi.mock('@/plugins/i18n', () => ({
    default: {
        global: {
            t: (key: string, params?: Record<string, unknown>) => {
                if (key === 'App.Titles.Error') return 'Error'
                if (key === 'App.Titles.Pause') return 'Pause'
                if (key === 'App.Titles.Complete') return `Complete - ${(params as any)?.filename}`
                if (key === 'App.Titles.PrintingETA')
                    return `Printing ${(params as any)?.percent}% - ${(params as any)?.filename} - ETA ${(params as any)?.eta}`
                if (key === 'App.Titles.Printing')
                    return `Printing ${(params as any)?.percent}% - ${(params as any)?.filename}`
                return key
            },
        },
    },
}))

vi.mock('semver', () => ({
    default: {
        valid: (v: string) => {
            const validVersions = [
                '0.11.0',
                '0.8.0',
                '0.12.0',
                '0.9.0',
                '0.10.0',
                '0.7.0',
                'v0.11.0',
                'v0.8.0',
                'v0.12.0',
                'v0.9.0',
                'v0.10.0',
                'v0.7.0',
            ]
            if (validVersions.includes(v)) return v
            return null
        },
        gt: (a: string, b: string) => a > b,
        eq: (a: string, b: string) => a === b,
    },
}))

vi.mock('@/store/variables', () => ({
    minKlipperVersion: 'v0.11.0-257',
    minMoonrakerVersion: 'v0.8.0-306',
    defaultMode: 'dark',
    defaultTheme: 'mainsail',
    defaultLogoColor: '#D41216',
    defaultPrimaryColor: '#2196f3',
    defaultBigThumbnailBackground: '#1e1e1e',
}))

describe('root store', () => {
    let state: RootState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    describe('mutations', () => {
        it('setNaviDrawer stores value and persists to localStorage', () => {
            mutations.setNaviDrawer(state, true)
            expect(state.naviDrawer).toBe(true)
            expect(localStorage.setItem).toHaveBeenCalledWith('naviDrawer', true)
        })

        it('setInstancesDB updates instancesDB', () => {
            mutations.setInstancesDB(state, 'browser')
            expect(state.instancesDB).toBe('browser')
        })

        it('setConfigInstances updates configInstances', () => {
            const instances = [{ hostname: 'printer1' }]
            mutations.setConfigInstances(state, instances)
            expect(state.configInstances).toEqual(instances)
        })
    })

    describe('actions', () => {
        it('switchToDashboard navigates to root when not already there', () => {
            mockRouter.currentRoute.fullPath = '/console'
            actions.switchToDashboard()
            expect(mockRouter.push).toHaveBeenCalledWith('/')
        })

        it('switchToDashboard does nothing when already on dashboard', () => {
            mockRouter.currentRoute.fullPath = '/'
            actions.switchToDashboard()
            expect(mockRouter.push).not.toHaveBeenCalled()
        })

        it('setNaviDrawer commits naviDrawer', () => {
            const commit = vi.fn()
            ;(actions.setNaviDrawer as any)({ commit }, false)
            expect(commit).toHaveBeenCalledWith('setNaviDrawer', false)
        })

        it('importConfigJson sets hostname when instancesDB is moonraker', async () => {
            const commit = vi.fn()
            await (actions.importConfigJson as any)(
                { commit },
                { hostname: 'myprinter', port: '7125', path: '/mainsail' }
            )
            expect(commit).toHaveBeenCalledWith('socket/setData', { hostname: 'myprinter' })
            expect(commit).toHaveBeenCalledWith('socket/setData', { port: 7125 })
            expect(commit).toHaveBeenCalledWith('socket/setData', { route_prefix: '/mainsail' })
        })

        it('importConfigJson sets instancesDB when not moonraker', async () => {
            const commit = vi.fn()
            await (actions.importConfigJson as any)({ commit }, { instancesDB: 'browser' })
            expect(commit).toHaveBeenCalledWith('setInstancesDB', 'browser')
        })

        it('importConfigJson skips instances when instancesDB is browser', async () => {
            const commit = vi.fn()
            await (actions.importConfigJson as any)(
                { commit },
                { instancesDB: 'browser', instances: [{ hostname: 'p1' }] }
            )
            expect(commit).not.toHaveBeenCalledWith('setConfigInstances', expect.anything())
        })

        it('importConfigJson commits instances when instancesDB is json', async () => {
            const commit = vi.fn()
            const instances = [{ hostname: 'p1' }]
            await (actions.importConfigJson as any)({ commit }, { instancesDB: 'json', instances })
            expect(commit).toHaveBeenCalledWith('setInstancesDB', 'json')
            expect(commit).toHaveBeenCalledWith('setConfigInstances', instances)
        })
    })

    describe('getters', () => {
        it('getVersion returns package version', () => {
            expect(getters.getVersion(state, {}, {}, {})).toBe('0.0.0')
        })

        it('getTitle returns E3CNC when not connected', () => {
            const result = (getters as any).getTitle({ ...state, socket: { isConnected: false } }, {}, {}, {})
            expect(result).toBe('E3CNC')
        })

        it('getTitle returns Error when klippy not ready', () => {
            const result = (getters as any).getTitle(
                { ...state, socket: { isConnected: true }, server: { klippy_state: 'error' } },
                {},
                {},
                {}
            )
            expect(result).toBe('Error')
        })

        it('getTitle returns printername when idle and connected', () => {
            const result = (getters as any).getTitle(
                {
                    ...state,
                    socket: { isConnected: true },
                    server: { klippy_state: 'ready' },
                    printer: { print_stats: { state: 'standby' } },
                    gui: { general: { printername: 'My CNC' } },
                },
                { 'printer/getEstimatedTimeETAFormat': '--', 'printer/getPrintPercent': 0 },
                {},
                {}
            )
            expect(result).toBe('My CNC')
        })

        it('getTitle returns Pause when printer is paused', () => {
            const result = (getters as any).getTitle(
                {
                    ...state,
                    socket: { isConnected: true },
                    server: { klippy_state: 'ready' },
                    printer: { print_stats: { state: 'paused' } },
                },
                {},
                {},
                {}
            )
            expect(result).toBe('Pause')
        })

        it('getTitle returns Complete when print is complete', () => {
            const result = (getters as any).getTitle(
                {
                    ...state,
                    socket: { isConnected: true },
                    server: { klippy_state: 'ready' },
                    printer: { print_stats: { state: 'complete', filename: 'test.gcode' } },
                    gui: { general: { printername: '' } },
                },
                {},
                {},
                {}
            )
            expect(result).toContain('Complete')
            expect(result).toContain('test.gcode')
        })

        it('getDependencies returns empty array when versions are sufficient', () => {
            const result = (getters as any).getDependencies({
                ...state,
                printer: { software_version: 'v0.12.0-300' },
                server: { moonraker_version: 'v0.9.0-400' },
            })
            expect(result).toEqual([])
        })

        it('getDependencies flags outdated Klipper', () => {
            const result = (getters as any).getDependencies({
                ...state,
                printer: { software_version: 'v0.10.0-100' },
                server: { moonraker_version: 'v0.9.0-400' },
            })
            expect(result).toHaveLength(1)
            expect(result[0].serviceName).toBe('Klipper')
        })

        it('getDependencies flags outdated Moonraker', () => {
            const result = (getters as any).getDependencies({
                ...state,
                printer: { software_version: 'v0.12.0-300' },
                server: { moonraker_version: 'v0.7.0-200' },
            })
            expect(result).toHaveLength(1)
            expect(result[0].serviceName).toBe('Moonraker')
        })
    })
})
