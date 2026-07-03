import { ActionContext, ActionTree } from 'vuex'
import { GuiNotificationState, GuiNotificationStateDismissEntry } from './types'
import { RootState } from '../../types'
import { getSocket } from '@/store/runtime'

export const actions: ActionTree<GuiNotificationState, RootState> = {
    reset({ commit }: ActionContext<GuiNotificationState, RootState>) {
        commit('reset')
    },

    upload({ state }: ActionContext<GuiNotificationState, RootState>) {
        getSocket().emit('server.database.post_item', {
            namespace: 'mainsail',
            key: 'notifications.dismiss',
            value: state.dismiss,
        })
    },

    close({ dispatch }: ActionContext<GuiNotificationState, RootState>, payload: any) {
        const posFirstSlash = payload.id.indexOf('/')
        if (posFirstSlash === -1) return

        const category = payload.id.slice(0, posFirstSlash)
        const id = payload.id.slice(posFirstSlash + 1)

        dispatch('storeDismiss', {
            entry_id: id,
            category,
            type: 'ever',
            time: null,
        })
    },

    dismiss({ dispatch }: ActionContext<GuiNotificationState, RootState>, payload: any) {
        const posFirstSlash = payload.id.indexOf('/')
        if (posFirstSlash === -1) return

        const category = payload.id.slice(0, posFirstSlash)
        const id = payload.id.slice(posFirstSlash + 1)

        dispatch('storeDismiss', {
            entry_id: id,
            category,
            type: payload.type,
            time: payload.time,
        })
    },

    async storeDismiss(
        { commit, dispatch, state }: ActionContext<GuiNotificationState, RootState>,
        payload: { entry_id: string; category: string; type: string; time: number | null }
    ) {
        let date = new Date().getTime()
        if (payload.type === 'time') {
            date = new Date().getTime() + (payload.time ?? 0) * 1000
        }

        const newDismiss: GuiNotificationStateDismissEntry = {
            id: payload.entry_id,
            category: payload.category,
            type: payload.type,
            date,
        }

        if (
            state.dismiss.filter(
                (dismiss: any) =>
                    dismiss.id === newDismiss.id &&
                    dismiss.category === newDismiss.category &&
                    dismiss.type === newDismiss.type
            ).length
        ) {
            await commit('removeDismiss', newDismiss)
        }

        await commit('addDismiss', newDismiss)
        await dispatch('upload')
    },
}
