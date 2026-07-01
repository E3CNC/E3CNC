import { printer } from '@/store/farm/printer'
import { ActionContext, Module } from 'vuex'
import { FarmState } from '@/store/farm/types'
import { RootState } from '@/store/types'

export const getDefaultState = (): FarmState => {
    return {}
}

// initial state
const state = () => {
    return getDefaultState()
}

export const farm: Module<FarmState, RootState> = {
    namespaced: true,
    state: state,
    getters: {
        countPrinters: (state: FarmState) => {
            return Object.keys(state).length
        },
        getPrinters: (state: FarmState) => {
            return state
        },
        getPrinterName: (state: FarmState, getters: any) => (namespace: string) => {
            return getters[namespace + '/getPrinterName']
        },
        getPrinterSocketState: (state: FarmState, getters: any) => (namespace: string) => {
            return (
                getters[namespace + '/getPrinterSocketState'] ?? {
                    isConnecting: false,
                    isConnected: false,
                }
            )
        },
        existsPrinter: (state: FarmState) => (namespace: string) => {
            return Object.keys(state).includes(namespace)
        },
    },
    actions: {
        registerPrinter({ commit, dispatch }: ActionContext<FarmState, RootState>, payload: any) {
            if (!(this as any).hasModule(['farm', payload.id])) {
                (this as any).registerModule(['farm', payload.id], printer)
                commit('farm/' + payload.id + '/setSocketData', { ...payload, _namespace: payload.id }, { root: true })

                if ('settings' in payload)
                    commit('farm/' + payload.id + '/setSettings', payload.settings, { root: true })
                dispatch('farm/' + payload.id + '/connect', {}, { root: true })
            }
        },
        updatePrinter({ dispatch, commit }: ActionContext<FarmState, RootState>, payload: any) {
            commit(payload.id + '/setSocketData', {
                hostname: payload.values.hostname,
                port: payload.values.port,
                path: payload.values.path,
                isConnecting: true,
            })
            dispatch(payload.id + '/reconnect')
        },
        unregisterPrinter({ state }: ActionContext<FarmState, RootState>, id: any) {
            if (id in state) {
                state[id].socket?.instance?.close()
                ;(this as any).unregisterModule(['farm', id])
            }
        },
    },
    mutations: {},
}
