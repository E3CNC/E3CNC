import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mutations } from '@/store/server/timelapse/mutations'
import { actions } from '@/store/server/timelapse/actions'
import { getDefaultState } from '@/store/server/timelapse/index'
import type { ServerTimelapseState } from '@/store/server/timelapse/types'

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

describe('server timelapse store', () => {
    let state: ServerTimelapseState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    it('merges settings and resets render state', () => {
        mutations.setSettings(state, { enabled: false, camera: 'cam1', ignored: true } as any)
        mutations.setLastFrame(state, { count: 3, file: 'frame.jpg' })
        mutations.setRenderStatus(state, { status: 'rendering', progress: 55 })
        mutations.resetSnackbar(state)

        expect(state.settings.enabled).toBe(false)
        expect(state.settings.camera).toBe('cam1')
        expect(state.lastFrame).toEqual({ count: 3, file: 'frame.jpg' })
        expect(state.rendering).toEqual({ status: '', progress: 0, filename: '' })
    })

    it('handles timelapse events and actions', async () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        await actions.initSettings({ commit, dispatch } as any, {
            requestParams: {},
            enabled: false,
            camera: 'cam1',
        })
        expect(commit).toHaveBeenCalledWith('setSettings', { enabled: false, camera: 'cam1' })
        expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/timelapse/init', { root: true })

        actions.getEvent({ commit } as any, { action: 'newframe', frame: '12', framefile: 'frame.jpg' })
        expect(commit).toHaveBeenCalledWith('setLastFrame', { count: 12, file: 'frame.jpg' })

        actions.getEvent({ commit } as any, { action: 'render', status: 'error', msg: 'boom' })
        expect(mockToast.error).toHaveBeenCalledWith('boom')
        expect(commit).toHaveBeenCalledWith('resetSnackbar')

        state.settings.camera = 'cam1'
        actions.updateCamSettings({ dispatch, state } as any, { oldName: 'cam1', newName: 'cam2' })
        expect(dispatch).toHaveBeenCalledWith('saveSetting', { camera: 'cam2' })

        actions.saveSetting(null as any, { enabled: true })
        expect(mockSocket.emit).toHaveBeenCalledWith('machine.timelapse.post_settings', { enabled: true }, { action: 'server/timelapse/initSettings' })
    })
})
