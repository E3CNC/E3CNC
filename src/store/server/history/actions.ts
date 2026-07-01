import { ActionContext, ActionTree } from 'vuex'
import { getSocket } from '@/store/runtime'
import type { ServerHistoryState, ServerHistoryStateJob } from '@/store/server/history/types'
import { RootState } from '@/store/types'

export const actions: ActionTree<ServerHistoryState, RootState> = {
    reset({ commit }: ActionContext<ServerHistoryState, RootState>) {
        commit('reset')
    },

    init() {
        getSocket().emit(
            'server.history.list',
            { start: 0, limit: 50, max: 100 },
            { action: 'server/history/getHistory' }
        )
        getSocket().emit('server.history.totals', {}, { action: 'server/history/getTotals' })
    },

    getTotals({ commit }: ActionContext<ServerHistoryState, RootState>, payload: any) {
        commit('setTotals', payload.job_totals)

        const auxiliary_totals = payload.auxiliary_totals ?? []
        if (auxiliary_totals.length) {
            commit('setAuxiliaryTotals', auxiliary_totals)
        }
    },

    async getHistory({ commit, dispatch, state }: ActionContext<ServerHistoryState, RootState>, payload: any) {
        if ('requestParams' in payload && (payload.requestParams?.start ?? 0) === 0) commit('resetJobs')

        payload.jobs?.forEach((job: ServerHistoryStateJob) => {
            if (state.jobs.findIndex((stateJob: any) => stateJob.job_id === job.job_id) === -1) commit('addJob', job)
        })

        const start = payload.requestParams?.start ?? 0
        const limit = payload.requestParams?.limit ?? 50
        const max = payload.requestParams?.max ?? null

        if (limit > 0 && (max === null || max > start + limit) && payload.jobs?.length === limit) {
            getSocket().emit(
                'server.history.list',
                {
                    start: start + limit,
                    limit: limit,
                    max: max,
                },
                { action: 'server/history/getHistory' }
            )

            // stop here until all pulls are done
            return
        }

        if (payload.jobs?.length < limit) {
            dispatch('socket/removeLoading', { name: 'historyLoadAll' }, { root: true })
            commit('setAllLoaded')
        }

        dispatch('loadHistoryNotes')
    },

    loadHistoryNotes({ dispatch, rootState }: ActionContext<ServerHistoryState, RootState>) {
        if (rootState.server?.dbNamespaces.includes('history_notes'))
            getSocket().emit(
                'server.database.get_item',
                { namespace: 'history_notes' },
                { action: 'server/history/initHistoryNotes' }
            )
        else dispatch('socket/removeInitModule', 'server/history/init', { root: true })
    },

    async initHistoryNotes({ commit, dispatch }: ActionContext<ServerHistoryState, RootState>, payload: any) {
        const job_ids = Object.keys(payload.value)

        for (const job_id of job_ids) {
            const noteObject: { text: string } = payload.value[job_id]
            await commit('setHistoryNotes', {
                job_id,
                text: noteObject.text,
            })
        }

        await dispatch('socket/removeInitModule', 'server/history/init', { root: true })
    },

    getChanged({ commit }: ActionContext<ServerHistoryState, RootState>, payload: any) {
        if (payload.action === 'added') commit('addJob', payload.job)
        else if (payload.action === 'finished') commit('updateJob', payload.job)

        getSocket().emit('server.history.totals', {}, { action: 'server/history/getTotals' })
    },

    getDeletedJobs({ commit }: ActionContext<ServerHistoryState, RootState>, payload: any) {
        if ('deleted_jobs' in payload && Array.isArray(payload.deleted_jobs)) {
            payload.deleted_jobs.forEach((jobId: ServerHistoryStateJob) => {
                commit('destroyJob', jobId)
            })
        }
    },

    saveHistoryNote({ commit }: ActionContext<ServerHistoryState, RootState>, payload: { job_id: string; note: string }) {
        getSocket().emit('server.database.post_item', {
            namespace: 'history_notes',
            key: payload.job_id,
            value: { text: payload.note },
        })

        commit('setHistoryNotes', {
            job_id: payload.job_id,
            text: payload.note,
        })
    },
}
