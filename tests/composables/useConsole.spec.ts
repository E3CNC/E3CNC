import { describe, it, expect, vi } from 'vitest'
import { useConsole } from '@/composables/useConsole'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'

function mountComposable(stateOverrides: Record<string, any> = {}) {
    const store = createStore({
        state: {
            printer: {
                gcode: {
                    commands: {
                        G28: { help: 'Home all axes' },
                        G91: {},
                    },
                },
            },
            gui: {
                console: {
                    direction: 'table',
                    hideWaitTemperatures: true,
                    hideTlCommands: false,
                    consolefilters: {
                        f1: { bool: true, name: 'Filter 1', regex: 'error' },
                    },
                    autoscroll: true,
                    rawOutput: false,
                },
                gcodehistory: {
                    entries: ['G28', 'G91'],
                },
            },
            ...stateOverrides,
        },
    })
    vi.spyOn(store, 'dispatch')

    let result: any
    const TestComponent = {
        template: '<div></div>',
        setup() {
            result = useConsole()
            return {}
        },
    }
    mount(TestComponent, { global: { plugins: [store] } })
    return { composable: result, store }
}

describe('useConsole', () => {
    it('computes helplist from printer gcode commands', () => {
        const { composable: c } = mountComposable()
        expect(c.helplist.value).toEqual([
            { command: 'G28', help: 'Home all axes' },
            { command: 'G91', help: '' },
        ])
    })

    it('returns empty helplist when no commands', () => {
        const { composable: c } = mountComposable({ printer: { gcode: { commands: {} } } })
        expect(c.helplist.value).toEqual([])
    })

    it('returns empty helplist when gcode is missing', () => {
        const { composable: c } = mountComposable({ printer: {} })
        expect(c.helplist.value).toEqual([])
    })

    it('computes consoleDirection from store', () => {
        const { composable: c } = mountComposable()
        expect(c.consoleDirection.value).toBe('table')
    })

    it('consoleDirection defaults to table when missing', () => {
        const { composable: c } = mountComposable({ gui: { console: {} } })
        expect(c.consoleDirection.value).toBe('table')
    })

    it('computes hideWaitTemperatures', () => {
        const { composable: c } = mountComposable()
        expect(c.hideWaitTemperatures.value).toBe(true)
    })

    it('setHideWaitTemperatures dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setHideWaitTemperatures(false)
        expect(store.dispatch).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'console.hideWaitTemperatures',
            value: false,
        })
    })

    it('computes hideTlCommands', () => {
        const { composable: c } = mountComposable()
        expect(c.hideTlCommands.value).toBe(false)
    })

    it('setHideTlCommands dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setHideTlCommands(true)
        expect(store.dispatch).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'console.hideTlCommands',
            value: true,
        })
    })

    it('computes customFilters from consolefilters', () => {
        const { composable: c } = mountComposable()
        expect(c.customFilters.value).toEqual({
            f1: { bool: true, name: 'Filter 1', regex: 'error' },
        })
    })

    it('returns empty customFilters when no filters', () => {
        const { composable: c } = mountComposable({ gui: { console: {} } })
        expect(c.customFilters.value).toEqual({})
    })

    it('computes autoscroll', () => {
        const { composable: c } = mountComposable()
        expect(c.autoscroll.value).toBe(true)
    })

    it('autoscroll defaults to true when missing', () => {
        const { composable: c } = mountComposable({ gui: { console: {} } })
        expect(c.autoscroll.value).toBe(true)
    })

    it('setAutoscroll dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setAutoscroll(false)
        expect(store.dispatch).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'console.autoscroll',
            value: false,
        })
    })

    it('computes rawOutput', () => {
        const { composable: c } = mountComposable()
        expect(c.rawOutput.value).toBe(false)
    })

    it('rawOutput defaults to false when missing', () => {
        const { composable: c } = mountComposable({ gui: { console: {} } })
        expect(c.rawOutput.value).toBe(false)
    })

    it('setRawOutput dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setRawOutput(true)
        expect(store.dispatch).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'console.rawOutput',
            value: true,
        })
    })

    it('computes lastCommands from gcodehistory', () => {
        const { composable: c } = mountComposable()
        expect(c.lastCommands.value).toEqual(['G28', 'G91'])
    })

    it('returns empty lastCommands when no history', () => {
        const { composable: c } = mountComposable({ gui: { gcodehistory: {} } })
        expect(c.lastCommands.value).toEqual([])
    })

    it('toggleFilter dispatches filterUpdate', () => {
        const { composable: c, store } = mountComposable()
        c.toggleFilter('f1', { bool: false, name: 'Filter 1', regex: 'error' })
        expect(store.dispatch).toHaveBeenCalledWith('gui/console/filterUpdate', {
            id: 'f1',
            values: { bool: false, name: 'Filter 1', regex: 'error' },
        })
    })

    it('clearConsole dispatches console clear action', () => {
        const { composable: c, store } = mountComposable()
        c.clearConsole()
        expect(store.dispatch).toHaveBeenCalledWith('gui/console/clear')
    })
})
