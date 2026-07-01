import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { GcodeviewerState } from '@/store/gcodeviewer/types'
import { markRaw } from 'vue'

export const mutations: MutationTree<GcodeviewerState> = {
    reset(state: GcodeviewerState) {
        Object.assign(state, getDefaultState())
    },

    setViewerBackup(state: GcodeviewerState, backup: any) {
        state.viewerBackup = markRaw(backup) /* viewer object is large and quite slow to proxy */
    },

    setCanvasBackup(state: GcodeviewerState, backup: any) {
        state.canvasBackup = backup
    },

    setLoadedFileBackup(state: GcodeviewerState, backup: any) {
        state.loadedFileBackup = backup
    },
}
