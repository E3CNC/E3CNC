import { describe, it, expect } from 'vitest'
import { farm } from '@/store/farm'
import { printer } from '@/store/farm/printer'
import { getDefaultState as getPrinterDefaultState } from '@/store/farm/printer/index'

it('covers farm and printer getters/mutations', () => {
    const farmState = {
        one: {},
        two: {},
    } as any

    expect((farm.getters as any).countPrinters(farmState)).toBe(2)
    expect((farm.getters as any).existsPrinter(farmState)('one')).toBe(true)
    expect((farm.getters as any).getPrinterSocketState(farmState, { 'one/getPrinterSocketState': { isConnected: true, isConnecting: true } })('one')).toEqual({
        isConnected: true,
        isConnecting: true,
    })

    const state = getPrinterDefaultState()
    expect((printer.getters as any).getSocketUrl(state)).toContain('/websocket')
    expect((printer.getters as any).getPrinterName(state)).toBe(':7125')

    state.socket.hostname = 'printer.local'
    state.socket.port = 81
    state.data.gui.general.printername = ''
    state.socket.path = '/mainsail'
    expect((printer.getters as any).getPrinterName(state)).toBe('printer.local:81/mainsail')

    state.socket.isConnected = true
    state.server.klippy_connected = true
    state.data.print_stats = { state: 'printing', filename: 'demo.gcode' } as any
    expect((printer.getters as any).getStatus(state, { getPrintPercent: 0.42 })).toBe('42% Printing')

    printer.mutations.setSocketData(state, { hostname: 'newhost', _namespace: 'remote-1', requestParams: {} } as any)
    printer.mutations.setData(state, { toolhead: { position: [1, 2, 3] } } as any)
    printer.mutations.setSettings(state, { speed: 100 } as any)

    expect(state._namespace).toBe('remote-1')
    expect(state.socket.hostname).toBe('newhost')
    expect(state.data.toolhead.position).toEqual([1, 2, 3])
    expect(state.settings.speed).toBe(100)
})
