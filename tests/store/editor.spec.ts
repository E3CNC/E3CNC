import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getters } from '@/store/editor/getters'
import { mutations } from '@/store/editor/mutations'
import { actions } from '@/store/editor/actions'
import { getDefaultState } from '@/store/editor/index'
import type { EditorState } from '@/store/editor/types'
import { sha256 } from 'js-sha256'

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

vi.mock('@/plugins/helpers', () => ({
    escapePath: (value: string) => value,
    formatFilesize: (value: number) => `FS:${value}`,
    windowBeforeUnloadFunction: vi.fn(),
}))

describe('editor store', () => {
    let state: EditorState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    it('returns the configured klipper restart method', () => {
        expect((getters as any).getKlipperRestartMethod(state, {}, { gui: { editor: { klipperRestartMethod: 'RESTART' } } })).toBe('RESTART')
        expect((getters as any).getKlipperRestartMethod(state, {}, { gui: {} })).toBe('FIRMWARE_RESTART')
    })

    it('updates editor mutations and hashing', () => {
        mutations.openFile(state, {
            filename: 'printer.cfg',
            fileroot: 'config',
            filepath: '',
            file: 'line1\r\nline2',
        })
        expect(state.loadedHash).toBe(sha256('line1\nline2'))
        expect(state.bool).toBe(true)

        mutations.updateSourcecode(state, 'line1\nline2\n')
        expect(state.changed).toBe(true)

        mutations.updateLoadedHash(state, 'line1\r\nline2\n')
        expect(state.loadedHash).toBe(sha256('line1\nline2\n'))
        expect(state.changed).toBe(false)

        mutations.hideEditor(state)
        expect(state.bool).toBe(false)
    })

    it('handles simple loading actions', () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        actions.downloadProgress(
            { commit } as any,
            {
                direction: 'downloading',
                filesize: 200,
                progressEvent: { loaded: 50, total: 100, rate: 10 },
            }
        )
        expect(commit).toHaveBeenCalledWith('updateLoader', {
            direction: 'downloading',
            speed: 'FS:10',
            loaded: 50,
            total: 200,
        })

        actions.clearLoader({ commit } as any)
        expect(commit).toHaveBeenCalledWith('updateLoaderState', false)
        expect(commit).toHaveBeenCalledWith('updateLoader', {
            direction: 'downloading',
            loaded: 0,
            total: 0,
            speed: '',
        })

        state.cancelToken = { cancel: vi.fn() } as any
        actions.cancelLoad({ state, commit, dispatch } as any)
        expect(commit).toHaveBeenCalledWith('updateCancelTokenSource', null)
        expect(dispatch).toHaveBeenCalledWith('clearLoader')
    })
})
