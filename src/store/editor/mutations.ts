import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { EditorState } from '@/store/editor/types'
import { sha256 } from 'js-sha256'

export const mutations: MutationTree<EditorState> = {
    reset(state: EditorState) {
        Object.assign(state, getDefaultState())
    },

    updateCancelTokenSource(state: EditorState, source: any) {
        state.cancelToken = source
    },

    updateLoaderState(state: EditorState, value: any) {
        state.loaderBool = value
    },

    updateLoader(state: EditorState, payload: any) {
        state.loaderProgress = payload
    },

    openFile(state: EditorState, payload: any) {
        state.filename = payload.filename
        state.fileroot = payload.fileroot
        state.filepath = payload.filepath
        state.sourcecode = payload.file

        // Because the used editor converts all Windows-Style line endings with unix ones on load,
        // the hash is computed with the source always having unix-style line endings.
        // https://github.com/codemirror/CodeMirror/issues/3395

        state.loadedHash = sha256(payload.file.replace(/(?:\r\n|\r|\n)/g, '\n'))
        state.changed = false
        state.bool = true
    },

    showEditor(state: EditorState) {
        state.bool = true
    },

    setFilename(state: EditorState, filename: any) {
        state.filename = filename
    },

    setPermissions(state: EditorState, filename: any) {
        state.permissions = filename
    },

    hideEditor(state: EditorState) {
        state.bool = false
    },

    updateSourcecode(state: EditorState, payload: any) {
        state.sourcecode = payload

        // To check if a file has been changed by the user, we need to calculate a hash
        // (or otherwise we would need to save the full file in memory twice). Simply listening
        // to the changed event is not enough, because if the user types an "a" and then deletes
        // the "a" again, the file would still be shown as changed, even though the edited file
        // is equal to the stored file.

        // I've tested this functionality with huge text files (60MB G-Code) and while calculating
        // the hash took 2 seconds per run, the editor itself is pretty laggy even without hash
        // calculations. Hash calculations with typical config file sizes (50KB) only take 1 or 2ms
        // on my machine, so I guess this is acceptable for most use cases.

        state.changed = sha256(payload) != state.loadedHash
    },

    updateLoadedHash(state: EditorState, payload: any) {
        state.loadedHash = sha256(payload.replace(/(?:\r\n|\r|\n)/g, '\n'))
        state.changed = false
    },
}
