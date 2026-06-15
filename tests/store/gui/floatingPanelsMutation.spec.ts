import { describe, it, expect, beforeEach } from 'vitest'
import { mutations } from '@/store/gui/mutations'
import { getDefaultState } from '@/store/gui/index'
import type { GuiState } from '@/store/gui/types'

describe('gui floating panels mutation', () => {
    let state: GuiState

    beforeEach(() => {
        state = getDefaultState()
    })

    describe('setFloatingPanels', () => {
        it('adds a panel to floatingPanels', () => {
            const panels = {
                temperature: { x: 100, y: 200, width: 400, height: 300, zIndex: 5 },
            }
            mutations.setFloatingPanels(state, panels)
            expect(state.dashboard.floatingPanels).toEqual(panels)
        })

        it('replaces the entire floatingPanels object', () => {
            state.dashboard.floatingPanels = {
                temperature: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
            }
            const newPanels = {
                macros: { x: 500, y: 200, width: 350, height: 250, zIndex: 2 },
            }
            mutations.setFloatingPanels(state, newPanels)
            expect(state.dashboard.floatingPanels).toEqual(newPanels)
            expect('temperature' in state.dashboard.floatingPanels).toBe(false)
        })

        it('supports multiple floating panels', () => {
            const panels = {
                temperature: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
                macros: { x: 500, y: 200, width: 350, height: 250, zIndex: 2 },
            }
            mutations.setFloatingPanels(state, panels)
            expect(Object.keys(state.dashboard.floatingPanels)).toHaveLength(2)
            expect(state.dashboard.floatingPanels.macros.zIndex).toBe(2)
        })

        it('clears all panels when empty object is passed', () => {
            state.dashboard.floatingPanels = {
                temperature: { x: 0, y: 0, width: 400, height: 300, zIndex: 5 },
            }
            mutations.setFloatingPanels(state, {})
            expect(state.dashboard.floatingPanels).toEqual({})
        })
    })
})
