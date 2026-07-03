import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import type { FarmPrinterState } from '@/store/farm/printer/types'
import { setDataDeep } from '@/plugins/helpers'

export const mutations: MutationTree<FarmPrinterState> = {
    reset(state: FarmPrinterState) {
        Object.assign(state, getDefaultState())
    },

    resetData(state: FarmPrinterState) {
        Object.assign(state.data, getDefaultState().data)
    },

    setSocketData(state: FarmPrinterState, payload: any) {
        if ('status' in payload) payload = payload.status
        if ('requestParams' in payload) delete payload.requestParams
        if ('_namespace' in payload) {
            state._namespace = payload._namespace
            delete payload._namespace
        }

        Object.entries(payload).forEach(([key, value]) => {
            ;(state.socket as Record<string, any>)[key] = value
        })
    },

    setData(state: FarmPrinterState, payload: any) {
        if ('requestParams' in payload) delete payload.requestParams

        Object.entries(payload).forEach(([key, value]) => {
            if (typeof value === 'object') {
                state.data[key] = {
                    ...state.data[key],
                    ...value,
                }
            } else state.data[key] = value
        })
    },

    setSettings(state: FarmPrinterState, payload: any) {
        state.settings = {
            ...state.settings,
            ...payload,
        }
    },

    addWsData(state: FarmPrinterState, payload: any) {
        const wsData = [...state.socket.wsData]
        wsData.push(payload)

        state.socket.wsData = wsData
    },

    removeWsData(state: FarmPrinterState, index: any) {
        const wsData = [...state.socket.wsData]
        wsData.splice(index, 1)

        state.socket.wsData = wsData
    },

    setKlippyConnected(state: FarmPrinterState, payload: any) {
        state.server.klippy_connected = payload
    },

    setCurrentFile(state: FarmPrinterState, payload: any) {
        if ('requestParams' in payload) delete payload.requestParams
        state.current_file = payload
    },

    setConfigDir(state: FarmPrinterState, payload: any) {
        Object.values(payload as Record<string, { path?: string }>).forEach((file) => {
            if (file.path?.startsWith('.theme/')) {
                state.theme_files.push(file.path)
            }
        })
    },

    setDatabases(state: FarmPrinterState, payload: any) {
        state.databases = payload
    },

    setMainsailData(state: FarmPrinterState, payload: any) {
        setDataDeep(state.data.gui, payload)
    },

    setWebcamsData(state: FarmPrinterState, payload: any) {
        state.data.webcams = payload
    },
}
