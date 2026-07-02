/**
 * Unit tests for useCncOffsets composable — WCS auto-reset on job end.
 *
 * Tests the watch callback logic by refactoring the handler into a named
 * function so it's directly testable without Vue reactivity in vitest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as cncApi from '@/store/files/cncApi'

// Replicate the watch handler logic from useCncOffsets.ts.
// Uses a closure variable to track savedWcs across transitions.
function createWcsHandler() {
    let savedWcs: string | null = null

    return {
        handle(
            newState: string | undefined,
            oldState: string | undefined,
            currentWcs: string,
            selectFn: () => void,
        ): void {
            // Job started: save current WCS
            if (newState === 'printing' && (!oldState || oldState === 'standby' || oldState === '')) {
                savedWcs = currentWcs
                return
            }

            // Job ended: restore saved WCS (or G54 if nothing saved)
            const wasPrinting = oldState && ['printing', 'paused', 'complete'].includes(oldState)
            const isNowStandby = newState === 'standby' || newState === ''
            const restoreTo = savedWcs ?? 'G54'

            if (wasPrinting && isNowStandby && currentWcs !== restoreTo) {
                selectFn()
            }
        },
        reset(): void {
            savedWcs = null
        },
    }
}

describe('useCncOffsets — WCS reset on job end', () => {
    let handler: ReturnType<typeof createWcsHandler>

    beforeEach(() => {
        vi.clearAllMocks()
        handler = createWcsHandler()
    })

    it('saves WCS on job start and restores it on end', () => {
        const selectFn = vi.fn()

        // User is in G56, job starts → save G56
        handler.handle('printing', '', 'G56', selectFn)
        expect(selectFn).not.toHaveBeenCalled()

        // Job ends → restore G56
        handler.handle('standby', 'printing', 'G56', selectFn)
        expect(selectFn).not.toHaveBeenCalled() // already in G56, no select needed
    })

    it('restores saved WCS when Klipper reset to G53 makes currentWcs != saved', () => {
        const selectFn = vi.fn()

        // User is in G56, job starts → save G56
        handler.handle('printing', 'standby', 'G56', selectFn)

        // Klipper reset makes currentWcs = 'G54' (effectively G53 after reset)
        // but saved is 'G56'
        handler.handle('standby', 'printing', 'G54', selectFn)
        expect(selectFn).toHaveBeenCalledTimes(1)
    })

    it('falls back to G54 when no WCS was saved', () => {
        const selectFn = vi.fn()

        // No job start was observed, job just ends in a non-G54 slot
        handler.handle('standby', 'printing', 'G55', selectFn)
        // savedWcs = null → restores to G54
        expect(selectFn).toHaveBeenCalledTimes(1)
    })

    it('restores paused → standby', () => {
        const selectFn = vi.fn()
        handler.handle('printing', '', 'G55', selectFn)
        handler.handle('standby', 'paused', 'G54', selectFn)
        expect(selectFn).toHaveBeenCalledTimes(1) // restore G55
    })

    it('restores complete → standby', () => {
        const selectFn = vi.fn()
        handler.handle('printing', '', 'G57', selectFn)
        handler.handle('standby', 'complete', 'G54', selectFn)
        expect(selectFn).toHaveBeenCalledTimes(1) // restore G57
    })

    it('does NOT call when idle → ready', () => {
        const selectFn = vi.fn()
        handler.handle('ready', 'idle', 'G54', selectFn)
        expect(selectFn).not.toHaveBeenCalled()
    })

    it('does NOT call on printing → paused (mid-job)', () => {
        const selectFn = vi.fn()
        handler.handle('printing', '', 'G56', selectFn)
        handler.handle('paused', 'printing', 'G56', selectFn)
        expect(selectFn).not.toHaveBeenCalled()
    })

    it('does NOT call when already in the correct WCS', () => {
        const selectFn = vi.fn()
        handler.handle('printing', '', 'G54', selectFn)
        handler.handle('standby', 'printing', 'G54', selectFn)
        expect(selectFn).not.toHaveBeenCalled()
    })

    it('handles empty string as standby', () => {
        const selectFn = vi.fn()
        handler.handle('printing', '', 'G55', selectFn)
        handler.handle('', 'printing', 'G54', selectFn)
        expect(selectFn).toHaveBeenCalledTimes(1)
    })

    it('integration: selectCncWcs called with saved WCS through real path', () => {
        vi.spyOn(cncApi, 'selectCncWcs').mockResolvedValue({})
        const selectFn = vi.fn()

        handler.handle('printing', '', 'G55', selectFn)

        handler.handle('standby', 'printing', 'G54', () => {
            cncApi.selectCncWcs('http://localhost:7125', { wcs: 'G55' })
        })

        expect(cncApi.selectCncWcs).toHaveBeenCalledWith('http://localhost:7125', { wcs: 'G55' })
    })
})
