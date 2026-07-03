import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { SocketState } from '@/store/socket/types'

export const mutations: MutationTree<SocketState> = {
    reset(state: SocketState) {
        const defaults = getDefaultState()

        state.initializationList = defaults.initializationList
    },

    setConnected(state: SocketState) {
        state.isConnected = true
        state.isConnecting = false
        state.connectingFailed = false
    },

    setDisconnected(state: SocketState, message?: string) {
        state.isConnected = false
        state.isConnecting = false
        state.connectingFailed = true
        state.connection_id = null

        if (message) state.connectionFailedMessage = message
    },

    setReconnecting(state: SocketState, val: boolean) {
        state.reconnecting = val
        state.reconnectAttempts = val ? state.reconnectAttempts + 1 : 0
    },

    setData(state: SocketState, payload: any) {
        if ('socket' in payload) payload = payload.socket

        Object.entries(payload).forEach(([key, value]) => {
            ;(state as Record<string, any>)[key] = value
        })
    },

    addLoading(state: SocketState, payload: any) {
        state.loadings.push(payload.name)
    },

    removeLoading(state: SocketState, payload: any) {
        const index = state.loadings.indexOf(payload.name)
        if (index > -1) state.loadings.splice(index, 1)
    },

    clearLoadings(state: SocketState) {
        if (state.loadings.length) state.loadings = []
    },

    addInitModule(state: SocketState, payload: any) {
        const list = [...state.initializationList]
        const index = list.indexOf(payload)
        if (index > -1) return

        list.push(payload)
        state.initializationList = list
    },

    removeInitModule(state: SocketState, payload: any) {
        const list = [...state.initializationList]
        const index = list.indexOf(payload)
        if (index === -1) return

        list.splice(index, 1)
        state.initializationList = list
    },

    removeInitComponent(state: SocketState, payload: any) {
        // remove all components which start with payload
        state.initializationList = state.initializationList.filter((item: string) => !item.startsWith(payload))
    },
}
