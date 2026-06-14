import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getters } from '@/store/server/history/getters'
import { mutations } from '@/store/server/history/mutations'
import { actions } from '@/store/server/history/actions'
import { getDefaultState } from '@/store/server/history/index'
import type { ServerHistoryState } from '@/store/server/history/types'

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

describe('server history store', () => {
    let state: ServerHistoryState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    it('computes totals and filtered job lists', () => {
        state.jobs = [
            {
                job_id: '1',
                exists: true,
                end_time: 0,
                filament_used: 4,
                filename: 'one.gcode',
                metadata: { uuid: 'uuid-1', size: 100, modified: 10 },
                print_duration: 10,
                status: 'completed',
                start_time: 0,
                total_duration: 10,
            },
            {
                job_id: '2',
                exists: true,
                end_time: 0,
                filament_used: 6,
                filename: 'two.gcode',
                metadata: { uuid: 'uuid-2', size: 200, modified: 20 },
                print_duration: 30,
                status: 'failed',
                start_time: 0,
                total_duration: 30,
            },
        ]

        expect((getters as any).getTotalPrintTime(state)).toBe(40)
        expect((getters as any).getTotalCompletedPrintTime(state)).toBe(10)
        expect((getters as any).getTotalFilamentUsed(state)).toBe(10)
        expect((getters as any).getTotalJobsCount(state)).toBe(2)
        expect((getters as any).getTotalCompletedJobsCount(state)).toBe(1)
        expect((getters as any).getAvgPrintTime(state, { getTotalCompletedPrintTime: 10, getTotalCompletedJobsCount: 1 })).toBe(10)
        expect((getters as any).getPrintJobById(state)('1')?.filename).toBe('one.gcode')
        expect((getters as any).getPrintStatusByFilename(state)('one.gcode', 10_000)).toBe('completed')
        expect((getters as any).getPrintJobsForGcodes(state)('one.gcode', 10_000, 100, 'uuid-1', null)).toHaveLength(1)
        expect(
            (getters as any).getFilteredJobList(state, {}, { gui: { view: { history: { hidePrintStatus: ['failed'] } } } })
        ).toHaveLength(1)
    })

    it('updates history state with mutations', () => {
        mutations.setTotals(state, { total_jobs: 1 })
        mutations.setAuxiliaryTotals(state, [{ field: 'temp', maximum: 1, provider: 'test', total: 1 } as any])
        mutations.addJob(state, {
            job_id: '1',
            exists: true,
            end_time: 0,
            filament_used: 1,
            filename: 'one.gcode',
            metadata: {},
            print_duration: 1,
            status: 'completed',
            start_time: 0,
            total_duration: 1,
        })
        mutations.setHistoryNotes(state, { job_id: '1', text: 'note' })
        mutations.updateJob(state, {
            job_id: '1',
            exists: true,
            end_time: 0,
            filament_used: 2,
            filename: 'one.gcode',
            metadata: {},
            print_duration: 2,
            status: 'failed',
            start_time: 0,
            total_duration: 2,
        })
        mutations.setAllLoaded(state)
        mutations.destroyJob(state, '1')
        mutations.resetJobs(state)

        expect(state.job_totals.total_jobs).toBe(1)
        expect(state.auxiliary_totals).toHaveLength(1)
        expect(state.all_loaded).toBe(true)
        expect(state.jobs).toEqual([])
    })

    it('loads history and stores notes', async () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        await actions.getHistory(
            { commit, dispatch, state, rootState: { server: { dbNamespaces: [] } } } as any,
            {
                jobs: [
                    {
                        job_id: '1',
                        exists: true,
                        end_time: 0,
                        filament_used: 1,
                        filename: 'one.gcode',
                        metadata: {},
                        print_duration: 1,
                        status: 'completed',
                        start_time: 0,
                        total_duration: 1,
                    },
                ],
                requestParams: { start: 0, limit: 50, max: 100 },
            }
        )

        expect(commit).toHaveBeenCalledWith('resetJobs')
        expect(commit).toHaveBeenCalledWith('addJob', expect.any(Object))
        expect(commit).toHaveBeenCalledWith('setAllLoaded')
        expect(dispatch).toHaveBeenCalledWith('socket/removeLoading', { name: 'historyLoadAll' }, { root: true })
        expect(dispatch).toHaveBeenCalledWith('loadHistoryNotes')

        await actions.saveHistoryNote({ commit } as any, { job_id: '1', note: 'saved' })
        expect(mockSocket.emit).toHaveBeenCalledWith('server.database.post_item', {
            namespace: 'history_notes',
            key: '1',
            value: { text: 'saved' },
        })
        expect(commit).toHaveBeenCalledWith('setHistoryNotes', { job_id: '1', text: 'saved' })
    })
})
