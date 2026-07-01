import { GetterTree } from 'vuex'
import type { GuiWebcamState, GuiWebcamStateWebcam } from '@/store/gui/webcams/types'
import { RootState } from '@/store/types'

export const getters: GetterTree<GuiWebcamState, RootState> = {
    getWebcams: (state: GuiWebcamState) => {
        return state.webcams.filter((webcam: GuiWebcamStateWebcam) => webcam.enabled)
    },

    getWebcam: (_state: GuiWebcamState, getters: any) => (name: string) => {
        const webcams = getters['getWebcams'] ?? []

        return webcams.find((webcam: GuiWebcamStateWebcam) => webcam.name === name)
    },
}
