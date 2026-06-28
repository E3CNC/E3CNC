import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { actions } from '@/store/files/actions'
import { getDefaultState } from '@/store/files/index'
import type { FileState } from '@/store/files/types'

const mockSocket = vi.hoisted(() => ({
    emit: vi.fn(),
    emitBatch: vi.fn(),
}))
const mockToast = vi.hoisted(() => ({
    error: vi.fn(),
    success: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => mockSocket,
    $toast: mockToast,
}))

vi.mock('@/plugins/i18n', () => ({
    default: {
        global: {
            t: (key: string, params?: Record<string, unknown>) => {
                const map: Record<string, string> = {
                    'Files.ScanMetaSuccess': `Scanned ${(params as any)?.filename}`,
                    'Files.SuccessfullyRenamed': `Renamed ${(params as any)?.filename}`,
                    'Files.SuccessfullyMoved': `Moved ${(params as any)?.filename}`,
                    'Files.SuccessfullyCreated': `Created ${(params as any)?.filename}`,
                    'Files.SuccessfullyDeleted': `Deleted ${(params as any)?.filename}`,
                    'FullscreenUpload.CannotUploadFile': 'Upload failed',
                }
                return map[key] ?? key
            },
        },
    },
}))

vi.mock('@/store/variables', () => ({
    hiddenDirectories: ['sys'],
    validGcodeExtensions: ['.gcode', '.nc'],
}))

vi.mock('axios', () => ({
    default: {
        CancelToken: { source: () => ({ token: 'token', cancel: vi.fn() }) },
        post: vi.fn().mockResolvedValue({ data: { item: { path: 'gcodes/test.gcode' } } }),
    },
}))

describe('files actions', () => {
    let state: FileState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    it('reset commits reset', () => {
        const commit = vi.fn()
        actions.reset({ commit } as any)
        expect(commit).toHaveBeenCalledWith('reset')
    })

    it('initRootDirs creates root dirs and emits get_directory', () => {
        const stateMock = { filetree: [] }
        const commit = vi.fn()
        actions.initRootDirs({ state: stateMock, commit } as any, ['gcodes', 'config'])
        expect(commit).toHaveBeenCalledWith('createRootDir', { name: 'gcodes', permissions: 'r' })
        expect(commit).toHaveBeenCalledWith('createRootDir', { name: 'config', permissions: 'r' })
        expect(mockSocket.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'gcodes' },
            { action: 'files/getDirectory' }
        )
        expect(mockSocket.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'config' },
            { action: 'files/getDirectory' }
        )
    })

    it('scanMetadata emits metascan for gcodes', () => {
        const commit = vi.fn()
        actions.scanMetadata({ commit } as any, { filename: 'gcodes/test.gcode' })
        expect(commit).toHaveBeenCalledWith('setMetadataRequested', { filename: 'test.gcode' })
        expect(mockSocket.emit).toHaveBeenCalledWith(
            'server.files.metascan',
            { filename: 'test.gcode' },
            { action: 'files/getScanMetadata' }
        )
    })

    it('getScanMetadata dispatches getMetadata and shows toast', () => {
        const dispatch = vi.fn()
        actions.getScanMetadata({ dispatch } as any, { filename: 'gcodes/test.gcode' })
        expect(dispatch).toHaveBeenCalledWith('getMetadata', { filename: 'gcodes/test.gcode' })
        expect(mockToast.success).toHaveBeenCalled()
    })

    it('requestMetadata batches up to 100 items', () => {
        const commit = vi.fn()
        const filenames = Array.from({ length: 150 }, (_, i) => ({ filename: `gcodes/test${i}.gcode` }))
        actions.requestMetadata({ commit } as any, filenames)
        expect(commit).toHaveBeenCalledTimes(150)
        expect(mockSocket.emitBatch).toHaveBeenCalledTimes(2)
    })

    it('getMetadata updates current file in printer store if match', () => {
        const commit = vi.fn()
        const rootState = { printer: { print_stats: { filename: 'gcodes/test.gcode' } } }
        actions.getMetadata({ commit, rootState } as any, { filename: 'gcodes/test.gcode', size: 100 })
        expect(commit).toHaveBeenCalledWith('printer/clearCurrentFile', null, { root: true })
        expect(commit).toHaveBeenCalledWith(
            'printer/setData',
            { current_file: { filename: 'gcodes/test.gcode', size: 100 } },
            { root: true }
        )
        expect(commit).toHaveBeenCalledWith('setMetadata', { filename: 'gcodes/test.gcode', size: 100 })
    })

    it('getMetadataCurrentFile commits to printer store', () => {
        const commit = vi.fn()
        actions.getMetadataCurrentFile({ commit } as any, { filename: 'test.gcode' })
        expect(commit).toHaveBeenCalledWith('printer/clearCurrentFile', null, { root: true })
        expect(commit).toHaveBeenCalledWith(
            'printer/setData',
            { current_file: { filename: 'test.gcode' } },
            { root: true }
        )
    })

    it('getMove shows error toast on error', () => {
        actions.getMove({} as any, { error: { message: 'File not found' } })
        expect(mockToast.error).toHaveBeenCalledWith('File not found')
    })

    it('getMove shows success toast on rename', () => {
        actions.getMove({} as any, {
            requestParams: { source: 'gcodes/old.gcode', dest: 'gcodes/new.gcode' },
        })
        expect(mockToast.success).toHaveBeenCalledWith('Renamed new.gcode')
    })

    it('getMove shows success toast on move to different dir', () => {
        actions.getMove({} as any, {
            requestParams: { source: 'gcodes/test.gcode', dest: 'gcodes/subdir/test.gcode' },
        })
        expect(mockToast.success).toHaveBeenCalledWith('Moved test.gcode')
    })

    it('getCreateDir shows error on failure', () => {
        actions.getCreateDir({} as any, { error: { message: 'Permission denied' } })
        expect(mockToast.error).toHaveBeenCalledWith('Permission denied')
    })

    it('getDeleteDir shows error on failure', () => {
        actions.getDeleteDir({} as any, { error: { message: 'Not empty' } })
        expect(mockToast.error).toHaveBeenCalledWith('Not empty')
    })

    it('getDeleteFile shows success for non-timelapse jpg', () => {
        actions.getDeleteFile({} as any, {
            item: { path: 'test.gcode', root: 'gcodes' },
        })
        expect(mockToast.success).toHaveBeenCalled()
    })

    it('uploadSetShow commits value', () => {
        const commit = vi.fn()
        actions.uploadSetShow({ commit } as any, true)
        expect(commit).toHaveBeenCalledWith('uploadSetShow', true)
    })

    it('uploadIncrementCurrentNumber increments from state', () => {
        const stateMock = { upload: { currentNumber: 3 } }
        const commit = vi.fn()
        actions.uploadIncrementCurrentNumber({ state: stateMock, commit } as any)
        expect(commit).toHaveBeenCalledWith('uploadSetCurrentNumber', 4)
    })

    it('rolloverLog shows toasts and re-fetches directory', async () => {
        vi.useFakeTimers()
        actions.rolloverLog({} as any, {
            rolled_over: ['moonraker.log'],
            failed: {},
        })
        expect(mockToast.success).toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(500)
        expect(mockSocket.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'logs' },
            { action: 'files/getDirectory' }
        )
        vi.useRealTimers()
    })

    it('initRootDirs skips roots that already exist', () => {
        const stateMock = { filetree: [{ filename: 'gcodes' }] }
        const commit = vi.fn()
        actions.initRootDirs({ state: stateMock, commit } as any, ['gcodes', 'config'])
        expect(commit).toHaveBeenCalledTimes(1)
        expect(commit).toHaveBeenCalledWith('createRootDir', { name: 'config', permissions: 'r' })
    })

    it('getDirectory reconciles created, modified, deleted, and disk-usage entries', () => {
        const commit = vi.fn()
        const directory = {
            childrens: [
                { isDirectory: true, filename: 'old-dir' },
                { isDirectory: false, filename: 'old.gcode' },
                { isDirectory: false, filename: 'same.gcode', size: 100, modified: new Date(1000) },
            ],
        }
        const getters = { getDirectory: vi.fn(() => directory) }
        const stateMock = { filetree: [{ filename: 'gcodes', permissions: 'r' }] }

        actions.getDirectory({ state: stateMock, commit, getters } as any, {
            requestParams: { path: 'gcodes/subdir' },
            dirs: [
                { dirname: 'new-dir', permissions: 'rw', modified: 2 },
                { dirname: 'sys', permissions: 'rw', modified: 3 },
            ],
            files: [
                { filename: 'same.gcode', permissions: 'rw', modified: 2, size: 150 },
                { filename: 'new.gcode', permissions: 'rw', modified: 4, size: 200 },
            ],
            root_info: { name: 'gcodes', permissions: 'rw' },
            disk_usage: { total: 100, used: 75, free: 25 },
        })

        expect(commit).toHaveBeenCalledWith('setDeleteDir', {
            item: { path: 'subdir/old-dir', root: 'gcodes' },
        })
        expect(commit).toHaveBeenCalledWith('setDeleteFile', {
            item: { path: 'subdir/old.gcode', root: 'gcodes' },
        })
        expect(commit).toHaveBeenCalledWith('setCreateDir', {
            item: { path: 'subdir/new-dir', root: 'gcodes', permissions: 'rw', modified: 2000 },
        })
        expect(mockSocket.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'gcodes/subdir/new-dir' },
            { action: 'files/getDirectory' }
        )
        expect(commit).toHaveBeenCalledWith('setModifyFile', {
            item: { path: 'subdir/same.gcode', root: 'gcodes', modified: 2, size: 150 },
        })
        expect(commit).toHaveBeenCalledWith('setCreateFile', {
            item: { path: 'subdir/new.gcode', root: 'gcodes', permissions: 'rw', modified: 4, size: 200 },
        })
        expect(commit).toHaveBeenCalledWith('setRootPermissions', { name: 'gcodes', permissions: 'rw' })
        expect(commit).toHaveBeenCalledWith('setDiskUsage', {
            disk_usage: { total: 100, used: 75, free: 25 },
            path: 'gcodes/subdir',
        })
    })

    it('scanMetadata ignores non-gcode roots', () => {
        const commit = vi.fn()
        actions.scanMetadata({ commit } as any, { filename: 'config/printer.cfg' })
        expect(commit).not.toHaveBeenCalled()
        expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it('getScanMetadata ignores empty filenames', () => {
        const dispatch = vi.fn()
        actions.getScanMetadata({ dispatch } as any, { filename: '' })
        expect(dispatch).not.toHaveBeenCalled()
        expect(mockToast.success).not.toHaveBeenCalled()
    })

    it('getMetadata exits early for null payload', () => {
        const commit = vi.fn()
        actions.getMetadata({ commit, rootState: {} } as any, null)
        expect(commit).not.toHaveBeenCalled()
    })

    it('filelist_changed requests metadata when a gcode file is moved', async () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        await (actions as any).filelist_changed({ commit, dispatch } as any, {
            action: 'move_file',
            source_item: { root: 'gcodes', path: 'old.gcode' },
            item: { root: 'gcodes', path: 'folder/new.gcode' },
        })

        expect(commit).toHaveBeenCalledWith('setMoveFile', expect.any(Object))
        expect(dispatch).toHaveBeenCalledWith('requestMetadata', [{ filename: 'gcodes/folder/new.gcode' }])
    })

    it('filelist_changed special-cases printer_autosave.cfg moves', async () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        await (actions as any).filelist_changed({ commit, dispatch } as any, {
            action: 'move_file',
            source_item: { root: 'config', path: 'printer_autosave.cfg' },
            item: { root: 'config', path: 'printer.cfg' },
        })

        expect(commit).toHaveBeenCalledWith('setCreateFile', expect.any(Object))
        expect(commit).not.toHaveBeenCalledWith('setMoveFile', expect.any(Object))
        expect(dispatch).not.toHaveBeenCalledWith('requestMetadata', expect.anything())
    })

    it('filelist_changed refreshes directory details after create_dir', async () => {
        const commit = vi.fn()
        const dispatch = vi.fn()

        await (actions as any).filelist_changed({ commit, dispatch } as any, {
            action: 'create_dir',
            item: { root: 'gcodes', path: 'folder' },
        })

        expect(commit).toHaveBeenCalledWith('setCreateDir', expect.any(Object))
        expect(mockSocket.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'gcodes/folder' },
            { action: 'files/getDirectory' }
        )
    })

    it('filelist_changed handles root updates and unknown actions', async () => {
        const commit = vi.fn()
        const dispatch = vi.fn()
        const consoleSpy = vi.spyOn(window.console, 'error').mockImplementation(() => {})

        await (actions as any).filelist_changed({ commit, dispatch } as any, {
            action: 'root_update',
            item: { root: 'config' },
        })
        await (actions as any).filelist_changed({ commit, dispatch } as any, {
            action: 'mystery',
        })

        expect(dispatch).toHaveBeenCalledWith(
            'server/addRootDirectory',
            { action: 'root_update', item: { root: 'config' } },
            { root: true }
        )
        expect(commit).toHaveBeenCalledWith('setRootUpdate', { action: 'root_update', item: { root: 'config' } })
        expect(consoleSpy).toHaveBeenCalledWith('Unknown filelist_changed action: mystery')
        consoleSpy.mockRestore()
    })

    it('getCreateDir and getDeleteDir show success toasts on success', () => {
        actions.getCreateDir({} as any, { requestParams: { path: 'gcodes/new-folder' } })
        actions.getDeleteDir({} as any, { requestParams: { path: 'gcodes/old-folder' } })
        expect(mockToast.success).toHaveBeenCalledWith('Created new-folder')
        expect(mockToast.success).toHaveBeenCalledWith('Deleted old-folder')
    })

    it('getDeleteFile skips success toast for timelapse jpg previews', () => {
        actions.getDeleteFile({} as any, {
            item: { path: 'preview.jpg', root: 'timelapse' },
        })
        expect(mockToast.success).not.toHaveBeenCalled()
    })

    it('uploadFile resolves uploaded filename and reports progress', async () => {
        const commit = vi.fn()
        const postMock = vi.mocked(axios.post)
        postMock.mockImplementationOnce(async (_url, _formData, config: any) => {
            config.onUploadProgress({ progress: 0.5, rate: 2048 })
            return { data: { item: { path: 'gcodes/folder/test.gcode' } } } as any
        })

        const result = await (actions as any).uploadFile(
            { commit, rootGetters: { 'socket/getUrl': 'http://moonraker' } } as any,
            {
                file: new File(['G1 X1'], 'test.gcode', { type: 'text/plain' }),
                path: 'folder',
                root: 'gcodes',
            }
        )

        expect(result).toBe('test.gcode')
        expect(commit).toHaveBeenCalledWith('uploadClearState')
        expect(commit).toHaveBeenCalledWith('uploadSetFilename', 'test.gcode')
        expect(commit).toHaveBeenCalledWith('uploadSetShow', true)
        expect(commit).toHaveBeenCalledWith('uploadSetPercent', 50)
        expect(commit).toHaveBeenCalledWith('uploadSetSpeed', 2048)
        expect(commit).toHaveBeenLastCalledWith('uploadSetShow', false)
    })

    it('uploadFile returns false and shows an error toast on failure', async () => {
        const commit = vi.fn()
        vi.mocked(axios.post).mockRejectedValueOnce(new Error('upload failed'))

        const result = await (actions as any).uploadFile(
            { commit, rootGetters: { 'socket/getUrl': 'http://moonraker' } } as any,
            {
                file: new File(['G1 X1'], 'broken.gcode', { type: 'text/plain' }),
                path: '',
                root: 'gcodes',
            }
        )

        expect(result).toBe(false)
        expect(commit).toHaveBeenLastCalledWith('uploadSetShow', false)
        expect(mockToast.error).toHaveBeenCalledWith('Upload failed')
    })

    it('downloadZip opens the encoded file URL', () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

        actions.downloadZip({ rootGetters: { 'socket/getUrl': 'http://moonraker' } } as any, {
            destination: { root: 'gcodes', path: 'folder/Test File.gcode' },
        })

        expect(openSpy).toHaveBeenCalledWith('http://moonraker/server/files/gcodes/folder/Test%20File.gcode')
        openSpy.mockRestore()
    })
})
