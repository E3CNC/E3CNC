import { describe, it, expect, beforeEach, vi } from 'vitest'
import { actions } from '@/store/gui/actions'
import { getDefaultState } from '@/store/gui/index'
import type { GuiState, PanelFloatingState } from '@/store/gui/types'

const mockSocket = vi.hoisted(() => ({
    emit: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => mockSocket,
    $toast: { success: vi.fn(), error: vi.fn() },
}))

describe('gui floating panels actions', () => {
    let state: GuiState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    describe('saveFloatingPanelPosition', () => {
        it('adds a new floating panel position', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const position: PanelFloatingState = { x: 100, y: 200, width: 400, height: 300, zIndex: 5 }

            ;(actions as any).saveFloatingPanelPosition(
                { commit, dispatch, state },
                { id: 'temperature', position }
            )

            expect(commit).toHaveBeenCalledWith('setFloatingPanels', {
                temperature: position,
            })
            expect(dispatch).toHaveBeenCalledWith('updateSettings', {
                keyName: 'dashboard.floatingPanels',
                newVal: { temperature: position },
            })
        })

        it('preserves existing panels when adding a new one', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            state.dashboard.floatingPanels = {
                macros: { x: 500, y: 200, width: 350, height: 250, zIndex: 2 },
            }
            const position: PanelFloatingState = { x: 100, y: 200, width: 400, height: 300, zIndex: 5 }

            ;(actions as any).saveFloatingPanelPosition(
                { commit, dispatch, state },
                { id: 'temperature', position }
            )

            expect(commit).toHaveBeenCalledWith('setFloatingPanels', {
                macros: { x: 500, y: 200, width: 350, height: 250, zIndex: 2 },
                temperature: position,
            })
        })

        it('updates an existing floating panel position', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            state.dashboard.floatingPanels = {
                temperature: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
            }
            const updated: PanelFloatingState = { x: 200, y: 300, width: 400, height: 300, zIndex: 2 }

            ;(actions as any).saveFloatingPanelPosition(
                { commit, dispatch, state },
                { id: 'temperature', position: updated }
            )

            expect(commit).toHaveBeenCalledWith('setFloatingPanels', {
                temperature: updated,
            })
            expect(dispatch).toHaveBeenCalledWith('updateSettings', {
                keyName: 'dashboard.floatingPanels',
                newVal: { temperature: updated },
            })
        })

        it('removes a floating panel when remove=true', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            state.dashboard.floatingPanels = {
                temperature: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
                macros: { x: 500, y: 200, width: 350, height: 250, zIndex: 2 },
            }

            ;(actions as any).saveFloatingPanelPosition(
                { commit, dispatch, state },
                { id: 'temperature', remove: true }
            )

            expect(commit).toHaveBeenCalledWith('setFloatingPanels', {
                macros: { x: 500, y: 200, width: 350, height: 250, zIndex: 2 },
            })
        })

        it('removes the last panel cleanly', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            state.dashboard.floatingPanels = {
                temperature: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
            }

            ;(actions as any).saveFloatingPanelPosition(
                { commit, dispatch, state },
                { id: 'temperature', remove: true }
            )

            expect(commit).toHaveBeenCalledWith('setFloatingPanels', {})
        })

        it('is a no-op when removing a non-existent panel', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            state.dashboard.floatingPanels = {
                macros: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
            }

            ;(actions as any).saveFloatingPanelPosition(
                { commit, dispatch, state },
                { id: 'temperature', remove: true }
            )

            expect(commit).toHaveBeenCalledWith('setFloatingPanels', {
                macros: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
            })
        })
    })

    describe('bringFloatingPanelToFront', () => {
        it('sets z-index to max + 1', () => {
            const dispatch = vi.fn()
            state.dashboard.floatingPanels = {
                temperature: { x: 0, y: 0, width: 400, height: 300, zIndex: 5 },
                macros: { x: 500, y: 200, width: 350, height: 250, zIndex: 10 },
            }

            ;(actions as any).bringFloatingPanelToFront(
                { dispatch, state },
                'temperature'
            )

            expect(dispatch).toHaveBeenCalledWith('saveFloatingPanelPosition', {
                id: 'temperature',
                position: { x: 0, y: 0, width: 400, height: 300, zIndex: 11 },
            })
        })

        it('works when only the current panel exists', () => {
            const dispatch = vi.fn()
            state.dashboard.floatingPanels = {
                temperature: { x: 0, y: 0, width: 400, height: 300, zIndex: 5 },
            }

            ;(actions as any).bringFloatingPanelToFront(
                { dispatch, state },
                'temperature'
            )

            expect(dispatch).toHaveBeenCalledWith('saveFloatingPanelPosition', {
                id: 'temperature',
                position: { x: 0, y: 0, width: 400, height: 300, zIndex: 6 },
            })
        })
    })
})
