import { ActionContext, ActionTree } from 'vuex'
import { SocketState } from '@/store/socket/types'
import { RootState } from '@/store/types'
import { getSocket, $toast } from '@/store/runtime'

export const actions: ActionTree<SocketState, RootState> = {
    reset({ commit }: ActionContext<SocketState, RootState>) {
        commit('setDisconnected')
        commit('clearLoadings')
        commit('reset')
    },

    setData({ commit }: ActionContext<SocketState, RootState>, payload: any) {
        commit('setData', payload)
    },

    async setSocket({ commit, state }: ActionContext<SocketState, RootState>, payload: any) {
        commit('setData', payload)

        try {
            const socket = getSocket()
            const normPath = payload.path.replaceAll(/(^\/*)|(\/*$)/g, '')
            const path = normPath.length > 0 ? `/${normPath}` : ''

            await socket.close()
            await socket.setUrl(state.protocol + '://' + payload.hostname + ':' + payload.port + path + '/websocket')
            await socket.connect()
        } catch {
            // socket not initialized yet
        }
    },

    onOpen({ commit, dispatch, rootState }: ActionContext<SocketState, RootState>) {
        //set socket connection to connected
        commit('setConnected')

        // init server
        dispatch('server/init', null, { root: true })
    },

    onClose({ commit }: ActionContext<SocketState, RootState>) {
        commit('setDisconnected')
    },

    onReconnecting({ commit, dispatch }: ActionContext<SocketState, RootState>) {
        commit('setReconnecting', true)
        $toast.info('Connection lost — reconnecting...', { duration: 4000 })
    },

    onReconnected({ commit, dispatch }: ActionContext<SocketState, RootState>) {
        commit('setReconnecting', false)
        commit('setConnected')
        $toast.success('Connection restored', { duration: 3000 })
        // Full server re-initialization after reconnect
        dispatch('server/reset', null, { root: true })
        dispatch('server/init', null, { root: true })
        dispatch('printer/reset', null, { root: true })
        dispatch('printer/init', null, { root: true })
    },

    onMessage({ commit, dispatch }: ActionContext<SocketState, RootState>, payload: any) {
        switch (payload.method) {
            case 'notify_status_update':
                dispatch('printer/getData', payload.params[0], { root: true })
                break

            case 'notify_gcode_response':
                dispatch('server/addEvent', Object.assign({ result: payload.params[0] }, { send: false }), {
                    root: true,
                })
                break

            case 'notify_klippy_ready':
                commit('server/setKlippyConnected', null, { root: true })
                dispatch('server/stopKlippyConnectedInterval', null, { root: true })
                dispatch('server/stopKlippyStateInterval', null, { root: true })
                dispatch('printer/init', null, { root: true })
                break

            case 'notify_klippy_disconnected':
                dispatch('server/setKlippyDisconnected', null, { root: true })
                break

            case 'notify_klippy_shutdown':
                dispatch('server/setKlippyShutdown', null, { root: true })
                break

            case 'notify_proc_stat_update':
                dispatch('server/updateProcStats', payload.params[0], { root: true })
                break

            case 'notify_cpu_throttled':
                commit('server/setThrottledState', payload.params[0], { root: true })
                break

            case 'notify_filelist_changed':
                dispatch('files/filelist_changed', payload.params[0], { root: true })
                break

            case 'notify_metadata_update':
                commit('files/setMetadata', payload.params[0], { root: true })
                break

            case 'notify_power_changed':
                commit('server/power/setStatus', payload.params[0], { root: true })
                break

            case 'notify_history_changed':
                dispatch('server/history/getChanged', payload.params[0], { root: true })
                break

            case 'notify_service_state_changed':
                dispatch('server/serviceStateChanged', payload.params[0], { root: true })
                break

            case 'notify_timelapse_event':
                dispatch('server/timelapse/getEvent', payload.params[0], { root: true })
                break

            case 'notify_job_queue_changed':
                dispatch('server/jobQueue/getEvent', payload.params[0], { root: true })
                break

            case 'notify_webcams_changed':
                dispatch('gui/webcams/initStore', payload.params[0], { root: true })
                break

            case 'notify_sensor_update':
                dispatch('server/sensor/updateSensors', payload.params[0], { root: true })
                break

            default:
                window.console.debug(payload)
        }
    },

    addLoading({ commit }: ActionContext<SocketState, RootState>, payload: string) {
        commit('addLoading', payload)
    },

    removeLoading({ commit }: ActionContext<SocketState, RootState>, payload: string) {
        commit('removeLoading', payload)
    },

    clearLoadings({ commit }: ActionContext<SocketState, RootState>) {
        commit('clearLoadings')
    },

    addInitModule({ commit }: ActionContext<SocketState, RootState>, payload: string) {
        commit('addInitModule', payload)
    },

    // remove only one module from init component like 'server/spoolman/getActiveSpoolId'
    removeInitModule({ commit }: ActionContext<SocketState, RootState>, payload: string) {
        commit('removeInitModule', payload)
    },

    // remove a complete init component like 'server/spoolman'
    removeInitComponent({ commit }: ActionContext<SocketState, RootState>, payload: string) {
        commit('removeInitComponent', payload)
    },

    reportDebug(_context: ActionContext<SocketState, RootState>, payload: any) {
        window.console.log(payload)
    },

    setConnectionFailed({ commit }: ActionContext<SocketState, RootState>, payload: any) {
        commit('setDisconnected', payload)
    },
}
