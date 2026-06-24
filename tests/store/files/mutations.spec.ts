/**
 * Tests for src/store/files/mutations.ts
 *
 * Tests the files store mutations which manage the file tree,
 * upload state, and file operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mutations } from '@/store/files/mutations'
import { getDefaultState } from '@/store/files/index'
import type { FileState } from '@/store/files/types'

const mockSocket = vi.hoisted(() => ({
    emit: vi.fn(),
}))

// Mock the runtime module
vi.mock('@/store/runtime', () => ({
    getSocket: () => mockSocket,
    $toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

describe('files mutations', () => {
    let state: FileState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    describe('reset', () => {
        it('resets state to defaults', () => {
            state.filetree = [{ isDirectory: true, filename: 'test' } as any]
            mutations.reset(state)
            expect(state.filetree).toEqual([])
        })
    })

    describe('createRootDir', () => {
        it('creates a root directory in filetree', () => {
            mutations.createRootDir(state, {
                name: 'gcodes',
                permissions: 'rw',
            })
            expect(state.filetree.length).toBe(1)
            expect(state.filetree[0].filename).toBe('gcodes')
            expect(state.filetree[0].isDirectory).toBe(true)
            expect(state.filetree[0].childrens).toEqual([])
        })
    })

    describe('setDeleteFile', () => {
        it('deletes a file from the tree', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [
                        { isDirectory: false, filename: 'test.gcode' },
                        { isDirectory: false, filename: 'other.gcode' },
                    ],
                } as any,
            ]

            mutations.setDeleteFile(state, {
                item: { root: 'gcodes', path: 'test.gcode' },
            })

            expect(state.filetree[0].childrens!.length).toBe(1)
            expect(state.filetree[0].childrens![0].filename).toBe('other.gcode')
        })
    })

    describe('setCreateDir', () => {
        it('creates a directory in the tree', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [],
                } as any,
            ]

            mutations.setCreateDir(state, {
                item: { root: 'gcodes', path: 'subdir', permissions: 'rw' },
            })

            expect(state.filetree[0].childrens!.length).toBe(1)
            expect(state.filetree[0].childrens![0].filename).toBe('subdir')
            expect(state.filetree[0].childrens![0].isDirectory).toBe(true)
        })
    })

    describe('setDeleteDir', () => {
        it('deletes a directory from the tree', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [
                        { isDirectory: true, filename: 'subdir', childrens: [] },
                        { isDirectory: false, filename: 'test.gcode' },
                    ],
                } as any,
            ]

            mutations.setDeleteDir(state, {
                item: { root: 'gcodes', path: 'subdir' },
            })

            expect(state.filetree[0].childrens!.length).toBe(1)
            expect(state.filetree[0].childrens![0].filename).toBe('test.gcode')
        })
    })

    describe('upload mutations', () => {
        describe('uploadSetShow', () => {
            it('sets upload show flag', () => {
                mutations.uploadSetShow(state, true)
                expect(state.upload.show).toBe(true)
            })
        })

        describe('uploadSetFilename', () => {
            it('sets upload filename', () => {
                mutations.uploadSetFilename(state, 'test.gcode')
                expect(state.upload.filename).toBe('test.gcode')
            })
        })

        describe('uploadSetPercent', () => {
            it('sets upload percent', () => {
                mutations.uploadSetPercent(state, 50)
                expect(state.upload.percent).toBe(50)
            })
        })

        describe('uploadSetSpeed', () => {
            it('sets upload speed', () => {
                mutations.uploadSetSpeed(state, 1024)
                expect(state.upload.speed).toBe(1024)
            })
        })

        describe('uploadSetCurrentNumber', () => {
            it('sets current upload number', () => {
                mutations.uploadSetCurrentNumber(state, 2)
                expect(state.upload.currentNumber).toBe(2)
            })
        })

        describe('uploadSetMaxNumber', () => {
            it('sets max upload number', () => {
                mutations.uploadSetMaxNumber(state, 5)
                expect(state.upload.maxNumber).toBe(5)
            })
        })

        describe('uploadClearState', () => {
            it('clears upload state', () => {
                state.upload = {
                    show: true,
                    filename: 'test.gcode',
                    currentNumber: 2,
                    maxNumber: 5,
                    cancelTokenSource: {} as any,
                    percent: 50,
                    speed: 1024,
                }

                mutations.uploadClearState(state)

                expect(state.upload.show).toBe(false)
                expect(state.upload.filename).toBe('')
                expect(state.upload.percent).toBe(0)
                expect(state.upload.speed).toBe(0)
                expect(state.upload.cancelTokenSource).toBeNull()
            })
        })
    })

    describe('setRootUpdate', () => {
        it('clears children of a root directory', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [{ isDirectory: false, filename: 'test.gcode' }],
                } as any,
            ]

            mutations.setRootUpdate(state, { item: { root: 'gcodes' } })
            expect(state.filetree[0].childrens!.length).toBe(0)
        })
    })

    describe('setRootPermissions', () => {
        it('updates permissions for a root directory', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    permissions: 'r',
                    childrens: [],
                } as any,
            ]

            mutations.setRootPermissions(state, { name: 'gcodes', permissions: 'rw' })
            expect(state.filetree[0].permissions).toBe('rw')
        })
    })

    describe('metadata mutations', () => {
        beforeEach(() => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [
                        {
                            isDirectory: false,
                            filename: 'test.gcode',
                            modified: new Date('2024-01-01'),
                            permissions: 'rw',
                            size: 100,
                            metadataRequested: false,
                            metadataPulled: false,
                        },
                        {
                            isDirectory: true,
                            filename: 'folder',
                            childrens: [
                                {
                                    isDirectory: false,
                                    filename: 'nested.gcode',
                                    modified: new Date('2024-01-01'),
                                    permissions: 'rw',
                                    size: 200,
                                    metadataRequested: false,
                                    metadataPulled: false,
                                },
                            ],
                        },
                    ],
                } as any,
            ]
        })

        it('setMetadataRequested marks an existing file', () => {
            mutations.setMetadataRequested(state, { filename: 'test.gcode' })
            expect(state.filetree[0].childrens![0].metadataRequested).toBe(true)
        })

        it('setMetadata copies allowed metadata and marks file as pulled', () => {
            mutations.setMetadata(state, {
                filename: 'test.gcode',
                estimated_time: 123,
                filament_total: 456,
                ignored_key: 'nope',
            })

            const file = state.filetree[0].childrens![0] as any
            expect(file.estimated_time).toBe(123)
            expect(file.filament_total).toBe(456)
            expect(file.ignored_key).toBeUndefined()
            expect(file.metadataRequested).toBe(true)
            expect(file.metadataPulled).toBe(true)
        })
    })

    describe('file tree mutations', () => {
        it('setCreateFile adds a new file to the parent directory', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [],
                } as any,
            ]

            mutations.setCreateFile(state, {
                item: {
                    root: 'gcodes',
                    path: 'test.gcode',
                    permissions: 'rw',
                    modified: 1710000000,
                    size: 321,
                },
            })

            expect(state.filetree[0].childrens).toHaveLength(1)
            expect((state.filetree[0].childrens![0] as any).filename).toBe('test.gcode')
            expect((state.filetree[0].childrens![0] as any).size).toBe(321)
        })

        it('setCreateFile updates an existing gcode file and requests metadata again', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [
                        {
                            isDirectory: false,
                            filename: 'test.gcode',
                            modified: new Date('2024-01-01'),
                            permissions: 'rw',
                            size: 100,
                            metadataRequested: true,
                            metadataPulled: true,
                        },
                    ],
                } as any,
            ]

            mutations.setCreateFile(state, {
                item: {
                    root: 'gcodes',
                    path: 'test.gcode',
                    permissions: 'rw',
                    modified: 1710000000,
                    size: 321,
                },
            })

            const file = state.filetree[0].childrens![0] as any
            expect(file.size).toBe(321)
            expect(file.metadataRequested).toBe(false)
            expect(file.metadataPulled).toBe(false)
            expect(mockSocket.emit).toHaveBeenCalledWith(
                'server.files.metadata',
                { filename: 'test.gcode' },
                { action: 'files/getMetadata' }
            )
        })

        it('setMoveFile moves files between directories and clears thumbnails', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [
                        {
                            isDirectory: true,
                            filename: 'src',
                            childrens: [
                                {
                                    isDirectory: false,
                                    filename: 'part.gcode',
                                    modified: new Date('2024-01-01'),
                                    permissions: 'rw',
                                    size: 100,
                                    metadataPulled: true,
                                    thumbnails: [{ relative_path: 'thumb.png' }],
                                },
                            ],
                        },
                        {
                            isDirectory: true,
                            filename: 'dest',
                            childrens: [],
                        },
                    ],
                } as any,
            ]

            mutations.setMoveFile(state, {
                source_item: { root: 'gcodes', path: 'src/part.gcode' },
                item: { root: 'gcodes', path: 'dest/renamed.gcode' },
            })

            const srcChildren = ((state.filetree[0].childrens![0] as any).childrens ?? [])
            const destChildren = ((state.filetree[0].childrens![1] as any).childrens ?? [])
            expect(srcChildren).toHaveLength(0)
            expect(destChildren[0].filename).toBe('renamed.gcode')
            expect((destChildren[0] as any).metadataPulled).toBe(false)
            expect((destChildren[0] as any).thumbnails).toBeUndefined()
        })

        it('setModifyFile updates timestamps, size, and clears cached thumbnails', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [
                        {
                            isDirectory: false,
                            filename: 'test.gcode',
                            modified: new Date('2024-01-01'),
                            permissions: 'rw',
                            size: 100,
                            metadataPulled: true,
                            thumbnails: [{ relative_path: 'thumb.png' }],
                        },
                    ],
                } as any,
            ]

            mutations.setModifyFile(state, {
                item: { root: 'gcodes', path: 'test.gcode', modified: 1710000100, size: 222 },
            })

            const file = state.filetree[0].childrens![0] as any
            expect(file.size).toBe(222)
            expect(file.metadataPulled).toBe(false)
            expect(file.thumbnails).toBeUndefined()
        })

        it('setMoveDir renames and moves a directory', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [
                        { isDirectory: true, filename: 'src', childrens: [{ isDirectory: true, filename: 'dirA', childrens: [] }] },
                        { isDirectory: true, filename: 'dest', childrens: [] },
                    ],
                } as any,
            ]

            mutations.setMoveDir(state, {
                source_item: { root: 'gcodes', path: 'src/dirA' },
                item: { root: 'gcodes', path: 'dest/dirB' },
            })

            expect(((state.filetree[0].childrens![0] as any).childrens ?? [])).toHaveLength(0)
            expect((((state.filetree[0].childrens![1] as any).childrens ?? [])[0] as any).filename).toBe('dirB')
        })

        it('setDiskUsage updates disk usage for nested directories', () => {
            state.filetree = [
                {
                    isDirectory: true,
                    filename: 'gcodes',
                    childrens: [
                        {
                            isDirectory: true,
                            filename: 'folder',
                            childrens: [],
                        },
                    ],
                } as any,
            ]

            mutations.setDiskUsage(state, {
                path: 'gcodes/folder',
                disk_usage: { total: 10, used: 7, free: 3 },
            })

            expect((state.filetree[0].childrens![0] as any).disk_usage).toEqual({ total: 10, used: 7, free: 3 })
        })
    })

    describe('upload mutation guards', () => {
        it('uploadSetPercent does not rewrite the same value', () => {
            state.upload.percent = 50
            mutations.uploadSetPercent(state, 50)
            expect(state.upload.percent).toBe(50)
        })

        it('uploadSetSpeed does not rewrite the same value', () => {
            state.upload.speed = 1024
            mutations.uploadSetSpeed(state, 1024)
            expect(state.upload.speed).toBe(1024)
        })
    })
})
