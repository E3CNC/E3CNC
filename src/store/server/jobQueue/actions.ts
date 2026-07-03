import { ActionContext, ActionTree } from 'vuex'
import { getSocket } from '@/store/runtime'
import { RootState } from '@/store/types'
import type { ServerJobQueueState, ServerJobQueueStateJob } from '@/store/server/jobQueue/types'

export const actions: ActionTree<ServerJobQueueState, RootState> = {
    reset({ commit }: ActionContext<ServerJobQueueState, RootState>) {
        commit('reset')
    },

    init() {
        getSocket().emit('server.job_queue.status', {}, { action: 'server/jobQueue/getStatus' })
    },

    getEvent({ commit }: ActionContext<ServerJobQueueState, RootState>, payload: any) {
        if ('updated_queue' in payload && payload.updated_queue !== null) commit('setQueuedJobs', payload.updated_queue)
        if ('queue_state' in payload) commit('setQueueState', payload.queue_state)
    },

    async getStatus({ commit, dispatch }: ActionContext<ServerJobQueueState, RootState>, payload: any) {
        if ('queued_jobs' in payload) commit('setQueuedJobs', payload.queued_jobs)
        if ('queue_state' in payload) commit('setQueueState', payload.queue_state)

        await dispatch('socket/removeInitModule', 'server/jobQueue/init', { root: true })
    },

    async addToQueue(_context: ActionContext<ServerJobQueueState, RootState>, filenames: string[]) {
        getSocket().emit('server.job_queue.post_job', { filenames: filenames })
    },

    changeCount(
        { dispatch, getters }: ActionContext<ServerJobQueueState, RootState>,
        payload: { job_id: string; count: number }
    ) {
        const jobs: ServerJobQueueStateJob[] = getters['getJobs']

        const index = jobs.findIndex((job) => job.job_id === payload.job_id)
        if (index === -1) return

        jobs[index].combinedIds = Array(payload.count - 1).fill(payload.job_id)

        dispatch('sendNewQueueList', { jobs })
    },

    changePosition(
        { dispatch, getters }: ActionContext<ServerJobQueueState, RootState>,
        payload: { oldIndex: number; newIndex: number }
    ) {
        const jobs: ServerJobQueueStateJob[] = getters['getJobs']

        const job = jobs.splice(payload.oldIndex, 1)[0]
        jobs.splice(payload.newIndex, 0, job)

        dispatch('sendNewQueueList', { jobs })
    },

    startByJobId({ dispatch, getters }: ActionContext<ServerJobQueueState, RootState>, job_id: string) {
        const jobs: ServerJobQueueStateJob[] = getters['getJobs']

        const index = jobs.findIndex((job) => job.job_id === job_id)
        if (index === -1) return

        const job = jobs.splice(index, 1)[0]
        jobs.splice(0, 0, job)

        dispatch('sendNewQueueList', { jobs, printStart: true })
    },

    sendNewQueueList(
        _context: ActionContext<ServerJobQueueState, RootState>,
        payload: { jobs: ServerJobQueueStateJob[]; printStart?: boolean }
    ) {
        const filenames = payload.jobs
            .map((job) => {
                const numJobs = (job.combinedIds?.length ?? 0) + 1
                // return job.filename if the job will be only printed one time
                if (numJobs === 1) return job.filename

                // return an array of job.filename if the job will be printed multiple times
                return Array(numJobs).fill(job.filename)
            })
            .flat()

        const emitOptions: { action?: string } = {}
        if (payload.printStart) emitOptions.action = 'server/jobQueue/start'

        getSocket().emit(
            'server.job_queue.post_job',
            {
                filenames,
                reset: true,
            },
            emitOptions
        )
    },

    deleteFromQueue(_context: ActionContext<ServerJobQueueState, RootState>, job_ids: string[]) {
        getSocket().emit('server.job_queue.delete_job', { job_ids })
    },

    clearQueue() {
        getSocket().emit('server.job_queue.delete_job', { all: true })
    },

    start() {
        getSocket().emit('server.job_queue.start', {}, { loading: 'startJobqueue' })
    },

    pause() {
        getSocket().emit('server.job_queue.pause', {}, { loading: 'pauseJobqueue' })
    },
}
