import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getters } from '@/store/server/power/getters'
import { mutations } from '@/store/server/power/mutations'
import { actions } from '@/store/server/power/actions'
import { getDefaultState } from '@/store/server/power/index'
import type { ServerPowerState } from '@/store/server/power/types'

const mockSocket = {
    emit: vi.fn(),
}

vi.mock('@/store/runtime', () => ({
    getSocket: () => mockSocket,
    $toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

describe('server power store', () => {
    let state: ServerPowerState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    it('reads and mutates power device state', () => {
        mutations.setDevices(state, [
            { device: 'light', status: 'off', locked_while_printing: false, type: 'relay' },
        ])
        mutations.setStatus(state, { device: 'light', status: 'on' })
        mutations.setStatus(state, { device: 'missing', status: 'error' })

        expect((getters as any).getDevices(state)).toEqual([
            { device: 'light', status: 'on', locked_while_printing: false, type: 'relay' },
        ])
    })

    it('handles simple power actions', async () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        await actions.getDevices({ commit, dispatch } as any, {
            devices: [{ device: 'bed', status: 'off', locked_while_printing: false, type: 'relay' }],
        })
        expect(commit).toHaveBeenCalledWith('setDevices', [{ device: 'bed', status: 'off', locked_while_printing: false, type: 'relay' }])
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/power/init', { root: true })

        actions.getStatus({ commit } as any, { error: false, device: 'bed', status: 'on' })
        expect(commit).toHaveBeenCalledWith('setStatus', { error: false, device: 'bed', status: 'on' })

        actions.responseToggle({ commit } as any, { requestParams: {}, bed: 'on', fan: 'off' })
        expect(commit).toHaveBeenCalledWith('setStatus', { device: 'bed', status: 'on' })
        expect(commit).toHaveBeenCalledWith('setStatus', { device: 'fan', status: 'off' })
        expect(mockSocket.emit).not.toHaveBeenCalled()
    })
})
