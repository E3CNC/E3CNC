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

// Mock the runtime module
vi.mock('@/store/runtime', () => ({
    getSocket: () => ({
        emit: vi.fn(),
    }),
    $toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

describe('files mutations', () => {
    let state: FileState

    beforeEach(() => {
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
                    childrens: [
                        { isDirectory: false, filename: 'test.gcode' },
                    ],
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
})
