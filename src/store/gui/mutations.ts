import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import type { GuiState, GuiStateDashboard, GuiStateLayoutoption, PanelFloatingState } from '@/store/gui/types'
import { setDataDeep } from '@/plugins/helpers'

export const mutations: MutationTree<GuiState> = {
    reset(state: GuiState) {
        Object.assign(state, getDefaultState())
    },

    setData(state: GuiState, payload: any) {
        setDataDeep(state, payload)
    },

    saveSetting(state: GuiState, payload: { name: string; value: unknown }) {
        const nested = payload.name.split('.').reduceRight<unknown>((value, key) => ({ [key]: value }), payload.value)
        setDataDeep(state, nested)
    },

    setHeaterChartVisibility(state: GuiState, payload: any) {
        const index = state.view.tempchart.hiddenDataset.indexOf(payload.name.toUpperCase())

        if (payload.hidden && index === -1) state.view.tempchart.hiddenDataset.push(payload.name.toUpperCase())
        else if (payload.hidden !== true && index > -1) state.view.tempchart.hiddenDataset.splice(index, 1)
    },

    setGcodefilesMetadata(state: GuiState, data: any) {
        const array = [...state.view.gcodefiles.hideMetadataColumns]
        const index = array.findIndex((value: string) => value === data.name)

        if (data.value && index !== -1) array.splice(index, 1)
        else if (!data.value && index === -1) array.push(data.name)

        state.view.gcodefiles.hideMetadataColumns = array
    },

    setGcodefilesShowHiddenFiles(state: GuiState, value: any) {
        state.view.gcodefiles.showHiddenFiles = value
    },

    setCurrentWebcam(state: GuiState, payload: any) {
        (state.view.webcam.currentCam as Record<string, string>)[payload.page] = payload.value
    },

    setHistoryColumns(state: GuiState, data: any) {
        if (data.value && state.view.history.hideColums.includes(data.name)) {
            state.view.history.hideColums.splice(state.view.history.hideColums.indexOf(data.name), 1)
        } else if (!data.value && !state.view.history.hideColums.includes(data.name)) {
            state.view.history.hideColums.push(data.name)
        }
    },

    setHistoryHidePrintStatus(state: GuiState, payload: any) {
        state.view.history.hidePrintStatus = payload
    },

    addClosePanel(state: GuiState, payload: any) {
        const nonExpandPanels = [...state.dashboard.nonExpandPanels[payload.viewport]]

        if (!nonExpandPanels.includes(payload.name)) {
            nonExpandPanels.push(payload.name)

            state.dashboard.nonExpandPanels[payload.viewport] = nonExpandPanels
        }
    },

    removeClosePanel(state: GuiState, payload: any) {
        const nonExpandPanels = [...state.dashboard.nonExpandPanels[payload.viewport]]
        const index = nonExpandPanels.indexOf(payload.name)
        if (index > -1) {
            nonExpandPanels.splice(index, 1)

            state.dashboard.nonExpandPanels[payload.viewport] = nonExpandPanels
        }
    },

    deleteFromDashboardLayout(state: GuiState, payload: any) {
        const layoutArray = [
            ...(state.dashboard[payload.layoutname as keyof GuiStateDashboard] as GuiStateLayoutoption[]),
        ]
        layoutArray.splice(payload.index, 1)
        state.dashboard[payload.layoutname as keyof GuiStateDashboard] =
            layoutArray as unknown as GuiStateLayoutoption[]
    },

    setFloatingPanels(state: GuiState, payload: Record<string, PanelFloatingState>) {
        state.dashboard.floatingPanels = payload
    },

    setChartDatasetStatus(state: GuiState, payload: { objectName: string; dataset: string; value: boolean }) {
        // set new value if object doesn't exist in view.tempchart.datasetSettings
        if (!(payload.objectName in state.view.tempchart.datasetSettings)) {
            const newVal: Record<string, boolean> = {}
            newVal[payload.dataset] = payload.value

            state.view.tempchart.datasetSettings[payload.objectName] = newVal
            return
        }

        state.view.tempchart.datasetSettings[payload.objectName][payload.dataset] = payload.value
    },

    setDatasetAdditionalSensorStatus(state: GuiState, payload: { objectName: string; dataset: string; value: boolean }) {
        // set new value if object doesn't exist in view.tempchart.datasetSettings
        if (!(payload.objectName in state.view.tempchart.datasetSettings)) {
            const newVal: { additionalSensors: Record<string, boolean> } = { additionalSensors: {} }
            newVal.additionalSensors[payload.dataset] = payload.value

            state.view.tempchart.datasetSettings[payload.objectName] = newVal
            return
        }

        // set new value if additionalSensor object doesn't exist in view.tempchart.datasetSettings
        if (!('additionalSensors' in state.view.tempchart.datasetSettings[payload.objectName])) {
            const newVal: Record<string, boolean> = {}
            newVal[payload.dataset] = payload.value

            state.view.tempchart.datasetSettings[payload.objectName].additionalSensors = newVal
            return
        }

        state.view.tempchart.datasetSettings[payload.objectName].additionalSensors[payload.dataset] = payload.value
    },
}
