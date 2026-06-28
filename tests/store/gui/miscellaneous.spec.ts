import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mutations } from '@/store/gui/miscellaneous/mutations'
import { actions } from '@/store/gui/miscellaneous/actions'
import { getters } from '@/store/gui/miscellaneous/getters'
import { getDefaultState } from '@/store/gui/miscellaneous/index'
import type { GuiMiscellaneousState } from '@/store/gui/miscellaneous/types'

const mockSocket = vi.hoisted(() => ({
    emit: vi.fn(),
}))
const mockToast = vi.hoisted(() => ({
    error: vi.fn(),
    success: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => mockSocket,
    $toast: mockToast,
}))

vi.mock('uuid', () => ({
    v4: () => 'mocked-uuid',
}))

describe('gui miscellaneous store', () => {
    let state: GuiMiscellaneousState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    describe('mutations', () => {
        it('reset restores defaults', () => {
            state.entries['e1'] = { name: 'test', type: 'light', lightgroups: {}, presets: {} }
            mutations.reset(state)
            expect(state.entries).toEqual({})
        })

        it('store creates an entry', () => {
            mutations.store(state, { id: 'e1', values: { name: 'LED', type: 'light' } })
            expect(state.entries['e1']).toEqual({
                name: 'LED',
                type: 'light',
                lightgroups: {},
                presets: {},
            })
        })

        it('storeLightgroup adds a lightgroup to an entry', () => {
            state.entries['e1'] = { name: 'LED', type: 'light', lightgroups: {}, presets: {} }
            mutations.storeLightgroup(state, { entryId: 'e1', values: { name: 'Group1', start: 0, end: 100 } })
            const keys = Object.keys(state.entries['e1'].lightgroups)
            expect(keys).toHaveLength(1)
            expect(state.entries['e1'].lightgroups[keys[0]].name).toBe('Group1')
        })

        it('updateLightgroup updates an existing lightgroup', () => {
            state.entries['e1'] = {
                name: 'LED',
                type: 'light',
                lightgroups: { lg1: { name: 'Old', start: 0, end: 50 } },
                presets: {},
            }
            mutations.updateLightgroup(state, {
                entryId: 'e1',
                lightgroupId: 'lg1',
                values: { name: 'New', start: 0, end: 100 },
            })
            expect(state.entries['e1'].lightgroups['lg1'].name).toBe('New')
            expect(state.entries['e1'].lightgroups['lg1'].end).toBe(100)
        })

        it('destroyLightgroup removes a lightgroup', () => {
            state.entries['e1'] = {
                name: 'LED',
                type: 'light',
                lightgroups: { lg1: { name: 'G1', start: 0, end: 100 } },
                presets: {},
            }
            mutations.destroyLightgroup(state, { entryId: 'e1', lightgroupId: 'lg1' })
            expect(state.entries['e1'].lightgroups).toEqual({})
        })

        it('storePreset adds a preset', () => {
            state.entries['e1'] = { name: 'LED', type: 'light', lightgroups: {}, presets: {} }
            mutations.storePreset(state, {
                entryId: 'e1',
                values: { name: 'P1', red: 255, blue: 0, green: 0, white: null },
            })
            const keys = Object.keys(state.entries['e1'].presets)
            expect(keys).toHaveLength(1)
            expect(state.entries['e1'].presets[keys[0]].name).toBe('P1')
        })

        it('destroyPreset removes a preset', () => {
            state.entries['e1'] = {
                name: 'LED',
                type: 'light',
                lightgroups: {},
                presets: { p1: { name: 'P1', red: 255, blue: 0, green: 0, white: null } },
            }
            mutations.destroyPreset(state, { entryId: 'e1', presetId: 'p1' })
            expect(state.entries['e1'].presets).toEqual({})
        })
    })

    describe('actions', () => {
        it('reset delegates to commit', () => {
            const commit = vi.fn()
            actions.reset({ commit } as any)
            expect(commit).toHaveBeenCalledWith('reset')
        })

        it('upload emits database post_item', () => {
            const stateMock = { entries: { e1: { name: 'LED', type: 'light', lightgroups: {}, presets: {} } } }
            actions.upload({ state: stateMock as any } as any, 'e1')
            expect(mockSocket.emit).toHaveBeenCalledWith('server.database.post_item', {
                namespace: 'mainsail',
                key: 'miscellaneous.entries.e1',
                value: stateMock.entries['e1'],
            })
        })

        it('store creates entry with uuid', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            await actions.store({ commit, dispatch } as any, { type: 'light', name: 'LED' })
            expect(commit).toHaveBeenCalledWith('store', { id: 'mocked-uuid', values: { type: 'light', name: 'LED' } })
            expect(dispatch).toHaveBeenCalledWith('upload', 'mocked-uuid')
        })

        it('storeLightgroup creates a lightgroup for an existing entry', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = {
                entries: {
                    'entry-1': { name: 'RGB', type: 'light', lightgroups: {}, presets: {} },
                },
            }

            await actions.storeLightgroup({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'RGB',
                lightgroup: { name: 'Group1', start: 0, end: 100 },
            })

            expect(commit).toHaveBeenCalledWith('storeLightgroup', {
                entryId: 'entry-1',
                values: { name: 'Group1', start: 0, end: 100 },
            })
            expect(dispatch).toHaveBeenCalledWith('upload', 'entry-1')
        })

        it('storeLightgroup creates a new entry if none exists', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = { entries: {} }

            await actions.storeLightgroup({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'NewDevice',
                lightgroup: { name: 'G1', start: 0, end: 50 },
            })

            expect(commit).toHaveBeenCalledWith('store', {
                id: 'mocked-uuid',
                values: { name: 'NewDevice', type: 'light' },
            })
            expect(commit).toHaveBeenCalledWith('storeLightgroup', {
                entryId: 'mocked-uuid',
                values: { name: 'G1', start: 0, end: 50 },
            })
            expect(dispatch).toHaveBeenCalledWith('upload', 'mocked-uuid')
        })

        it('updateLightgroup dispatches upload', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = {
                entries: {
                    'entry-1': { name: 'RGB', type: 'light', lightgroups: { lg1: {} }, presets: {} },
                },
            }

            await actions.updateLightgroup({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'RGB',
                lightgroupId: 'lg1',
                lightgroup: { name: 'G1', start: 10, end: 90 },
            })

            expect(commit).toHaveBeenCalledWith('updateLightgroup', {
                entryId: 'entry-1',
                lightgroupId: 'lg1',
                values: { name: 'G1', start: 10, end: 90 },
            })
            expect(dispatch).toHaveBeenCalledWith('upload', 'entry-1')
        })

        it('updateLightgroup returns early when entry not found', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = { entries: {} }

            await actions.updateLightgroup({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'Missing',
                lightgroupId: 'lg1',
                lightgroup: {},
            })

            expect(commit).not.toHaveBeenCalled()
            expect(dispatch).not.toHaveBeenCalled()
        })

        it('deleteLightgroup dispatches upload', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = {
                entries: {
                    'entry-1': { name: 'RGB', type: 'light', lightgroups: { lg1: {} }, presets: {} },
                },
            }

            await actions.deleteLightgroup({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'RGB',
                lightgroupId: 'lg1',
            })

            expect(commit).toHaveBeenCalledWith('destroyLightgroup', { entryId: 'entry-1', lightgroupId: 'lg1' })
            expect(dispatch).toHaveBeenCalledWith('upload', 'entry-1')
        })

        it('deleteLightgroup returns early when entry not found', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = { entries: {} }

            await actions.deleteLightgroup({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'Missing',
                lightgroupId: 'lg1',
            })

            expect(commit).not.toHaveBeenCalled()
            expect(dispatch).not.toHaveBeenCalled()
        })

        it('storePreset creates a preset via commit and uploads', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = {
                entries: {
                    'entry-1': { name: 'RGB', type: 'light', lightgroups: {}, presets: {} },
                },
            }

            await actions.storePreset({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'RGB',
                preset: { name: 'P1', red: 255, green: 0, blue: 0, white: null },
            })

            expect(commit).toHaveBeenCalledWith('storePreset', {
                entryId: 'entry-1',
                values: { name: 'P1', red: 255, green: 0, blue: 0, white: null },
            })
            expect(dispatch).toHaveBeenCalledWith('upload', 'entry-1')
        })

        it('updatePreset dispatches upload', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = {
                entries: {
                    'entry-1': { name: 'RGB', type: 'light', lightgroups: {}, presets: { p1: {} } },
                },
            }

            await actions.updatePreset({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'RGB',
                presetId: 'p1',
                preset: { name: 'P2' },
            })

            expect(commit).toHaveBeenCalledWith('updatePreset', {
                entryId: 'entry-1',
                presetId: 'p1',
                values: { name: 'P2' },
            })
            expect(dispatch).toHaveBeenCalledWith('upload', 'entry-1')
        })

        it('updatePreset returns early when entry not found', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = { entries: {} }

            await actions.updatePreset({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'Missing',
                presetId: 'p1',
                preset: {},
            })

            expect(commit).not.toHaveBeenCalled()
            expect(dispatch).not.toHaveBeenCalled()
        })

        it('deletePreset dispatches upload', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = {
                entries: {
                    'entry-1': { name: 'RGB', type: 'light', lightgroups: {}, presets: { p1: {} } },
                },
            }

            await actions.deletePreset({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'RGB',
                presetId: 'p1',
            })

            expect(commit).toHaveBeenCalledWith('destroyPreset', { entryId: 'entry-1', presetId: 'p1' })
            expect(dispatch).toHaveBeenCalledWith('upload', 'entry-1')
        })

        it('deletePreset returns early when entry not found', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = { entries: {} }

            await actions.deletePreset({ commit, dispatch, state: stateMock as any } as any, {
                type: 'light',
                name: 'Missing',
                presetId: 'p1',
            })

            expect(commit).not.toHaveBeenCalled()
            expect(dispatch).not.toHaveBeenCalled()
        })
    })

    describe('getters', () => {
        it('getEntries returns all entries with ids', () => {
            state.entries['e1'] = { name: 'LED', type: 'light', lightgroups: {}, presets: {} }
            const result = (getters as any).getEntries(state)
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('e1')
            expect(result[0].name).toBe('LED')
        })

        it('getEntry finds entry by type and name', () => {
            state.entries['e1'] = { name: 'LED', type: 'light', lightgroups: {}, presets: {} }
            const entries = (getters as any).getEntries(state)
            const resolvedGetters = { getEntries: entries }
            const result = (getters as any).getEntry(state, resolvedGetters)({ type: 'light', name: 'LED' })
            expect(result.name).toBe('LED')
        })

        it('getId returns entry id by type and name', () => {
            state.entries['e1'] = { name: 'LED', type: 'light', lightgroups: {}, presets: {} }
            const entries = (getters as any).getEntries(state)
            const getEntryFn = (getters as any).getEntry(state, { getEntries: entries })
            const result = (getters as any).getId(state, { getEntry: getEntryFn })({ type: 'light', name: 'LED' })
            expect(result).toBe('e1')
        })
    })
})
