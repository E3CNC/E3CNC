import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getters } from '@/store/server/jobQueue/getters'
import { mutations } from '@/store/server/jobQueue/mutations'
import { actions } from '@/store/server/jobQueue/actions'
import { getDefaultState } from '@/store/server/jobQueue/index'
import type { ServerJobQueueState } from '@/store/server/jobQueue/types'

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

describe('server job queue store', () => {
    let state: ServerJobQueueState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    it('groups queued jobs and fetches missing metadata', () => {
        state.queued_jobs = [
            { job_id: '1', filename: 'test.gcode', time_added: 1, time_in_queue: 10 },
            { job_id: '2', filename: 'test.gcode', time_added: 2, time_in_queue: 11 },
            { job_id: '3', filename: 'other.gcode', time_added: 3, time_in_queue: 12 },
        ]

        const files = {
            'gcodes/test.gcode': { metadataPulled: false },
            'gcodes/other.gcode': { metadataPulled: true },
        }

        const jobs = (getters as any).getJobs(state, {}, {}, {
            'files/getFile': (path: string) => files[path as keyof typeof files] ?? null,
        })

        expect(jobs).toHaveLength(2)
        expect(jobs[0].combinedIds).toEqual(['2'])
        expect(jobs[0].metadata).toEqual({ metadataPulled: false })
        expect(mockSocket.emit).toHaveBeenCalledWith('server.files.metadata', { filename: 'test.gcode' }, { action: 'files/getMetadata' })
        expect((getters as any).getJobsCount(state)).toBe(3)
    })

    it('updates queue mutations and actions', () => {
        mutations.setQueuedJobs(state, [{ job_id: '1', filename: 'a.gcode', time_added: 1, time_in_queue: 1 }])
        mutations.setQueueState(state, 'paused')
        expect(state.queue_state).toBe('paused')

        const commit = vi.fn()
        const dispatch = vi.fn()

        actions.sendNewQueueList(null as any, {
            jobs: [
                { job_id: '1', filename: 'a.gcode', time_added: 1, time_in_queue: 1, combinedIds: ['x'] },
                { job_id: '2', filename: 'b.gcode', time_added: 2, time_in_queue: 2 },
            ],
            printStart: true,
        })

        expect(mockSocket.emit).toHaveBeenCalledWith(
            'server.job_queue.post_job',
            {
                filenames: ['a.gcode', 'a.gcode', 'b.gcode'],
                reset: true,
            },
            { action: 'server/jobQueue/start' }
        )

        actions.changeCount(
            { dispatch, getters: { getJobs: [{ job_id: '1', filename: 'a.gcode', time_added: 1, time_in_queue: 1 }] } } as any,
            { job_id: '1', count: 3 }
        )
        expect(dispatch).toHaveBeenCalledWith('sendNewQueueList', {
            jobs: [{ job_id: '1', filename: 'a.gcode', time_added: 1, time_in_queue: 1, combinedIds: ['1', '1'] }],
        })

        actions.clearQueue()
        expect(mockSocket.emit).toHaveBeenCalledWith('server.job_queue.delete_job', { all: true })
        expect(commit).toBeDefined()
    })
})
