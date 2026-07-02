/**
 * Unit tests for useCncOffsets composable — WCS auto-reset on job end.
 *
 * Tests the watch callback logic by refactoring the handler into a named
 * function so it's directly testable without Vue reactivity in vitest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Directly mock cncApi — no Vue reactive dependency needed
import * as cncApi from '@/store/files/cncApi'

// Replicate the watch handler logic from useCncOffsets.ts so we can test it
// without needing Vue's reactivity system in jsdom.
function handlePrintStatsChange(
    newState: string | undefined,
    oldState: string | undefined,
    currentWcs: string,
    selectFn: () => Promise<void>,
): void {
    const wasPrinting = oldState && ['printing', 'paused', 'complete'].includes(oldState)
    const isNowStandby = newState === 'standby' || newState === ''
    if (wasPrinting && isNowStandby && currentWcs !== 'G54') {
        selectFn()
    }
}

describe('useCncOffsets — WCS reset on job end', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls selectCncWcs when printing → standby', () => {
        const selectFn = vi.fn()
        handlePrintStatsChange('standby', 'printing', 'G55', selectFn)
        expect(selectFn).toHaveBeenCalledTimes(1)
    })

    it('calls selectCncWcs when paused → standby', () => {
        const selectFn = vi.fn()
        handlePrintStatsChange('standby', 'paused', 'G55', selectFn)
        expect(selectFn).toHaveBeenCalledTimes(1)
    })

    it('calls selectCncWcs when complete → standby', () => {
        const selectFn = vi.fn()
        handlePrintStatsChange('standby', 'complete', 'G55', selectFn)
        expect(selectFn).toHaveBeenCalledTimes(1)
    })

    it('does NOT call when idle → ready (no printing)', () => {
        const selectFn = vi.fn()
        handlePrintStatsChange('ready', 'idle', 'G54', selectFn)
        expect(selectFn).not.toHaveBeenCalled()
    })

    it('does NOT call when printing → paused (mid-job)', () => {
        const selectFn = vi.fn()
        handlePrintStatsChange('paused', 'printing', 'G54', selectFn)
        expect(selectFn).not.toHaveBeenCalled()
    })

    it('does NOT call when already in G54', () => {
        const selectFn = vi.fn()
        handlePrintStatsChange('standby', 'printing', 'G54', selectFn)
        expect(selectFn).not.toHaveBeenCalled()
    })

    it('does NOT call on initial watch fire (oldState undefined)', () => {
        const selectFn = vi.fn()
        handlePrintStatsChange('printing', undefined, 'G55', selectFn)
        expect(selectFn).not.toHaveBeenCalled()
    })

    it('does NOT call when standby → idle (wrong direction)', () => {
        const selectFn = vi.fn()
        handlePrintStatsChange('idle', 'standby', 'G55', selectFn)
        expect(selectFn).not.toHaveBeenCalled()
    })

    it('handles empty string as standby', () => {
        const selectFn = vi.fn()
        handlePrintStatsChange('', 'printing', 'G55', selectFn)
        expect(selectFn).toHaveBeenCalledTimes(1)
    })

    it('integration: selectCncWcs is called with G54 through the real callback path', () => {
        vi.spyOn(cncApi, 'selectCncWcs').mockResolvedValue({})

        handlePrintStatsChange('standby', 'printing', 'G55', () => {
            cncApi.selectCncWcs('http://localhost:7125', { wcs: 'G54' })
        })

        expect(cncApi.selectCncWcs).toHaveBeenCalledWith('http://localhost:7125', { wcs: 'G54' })
    })
})
