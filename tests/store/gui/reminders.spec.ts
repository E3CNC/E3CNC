import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mutations } from '@/store/gui/reminders/mutations'
import { actions } from '@/store/gui/reminders/actions'
import { getters } from '@/store/gui/reminders/getters'
import { getDefaultState } from '@/store/gui/reminders/index'
import type { GuiRemindersState } from '@/store/gui/reminders/types'

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

describe('gui reminders store', () => {
    let state: GuiRemindersState

    beforeEach(() => {
        vi.clearAllMocks()
        state = getDefaultState()
    })

    describe('mutations', () => {
        it('reset restores defaults', () => {
            state.reminders['r1'] = {
                id: 'r1',
                name: 'Test',
                start_total_print_time: 1000,
                time_delta: 3600,
                repeating: false,
                snooze_print_hours_timestamps: [],
                snooze_epoch_timestamps: [],
            }
            mutations.reset(state)
            expect(state.reminders).toEqual({})
        })

        it('initStore replaces reminders from payload value', () => {
            const payload = {
                value: {
                    r1: {
                        name: 'Oil change',
                        start_total_print_time: 1000,
                        time_delta: 3600,
                        repeating: false,
                        snooze_print_hours_timestamps: [],
                        snooze_epoch_timestamps: [],
                    },
                },
            }
            mutations.initStore(state, payload)
            expect(state.reminders['r1'].name).toBe('Oil change')
        })

        it('store adds a reminder', () => {
            mutations.store(state, {
                id: 'r1',
                values: {
                    name: 'Lube',
                    start_total_print_time: 0,
                    time_delta: 7200,
                    repeating: true,
                    snooze_print_hours_timestamps: [],
                    snooze_epoch_timestamps: [],
                },
            })
            expect(state.reminders['r1'].name).toBe('Lube')
            expect(state.reminders['r1'].time_delta).toBe(7200)
        })

        it('update modifies an existing reminder', () => {
            state.reminders['r1'] = {
                id: 'r1',
                name: 'Old',
                start_total_print_time: 1000,
                time_delta: 3600,
                repeating: false,
                snooze_print_hours_timestamps: [],
                snooze_epoch_timestamps: [],
            }
            mutations.update(state, { id: 'r1', name: 'Updated' })
            expect(state.reminders['r1'].name).toBe('Updated')
            expect(state.reminders['r1'].time_delta).toBe(3600)
        })

        it('update does nothing for unknown id', () => {
            mutations.update(state, { id: 'unknown', name: 'New' })
            expect(state.reminders).toEqual({})
        })

        it('delete removes a reminder', () => {
            state.reminders['r1'] = {
                id: 'r1',
                name: 'Test',
                start_total_print_time: 0,
                time_delta: 3600,
                repeating: false,
                snooze_print_hours_timestamps: [],
                snooze_epoch_timestamps: [],
            }
            mutations.delete(state, 'r1')
            expect(state.reminders).toEqual({})
        })

        it('delete does nothing for unknown id', () => {
            mutations.delete(state, 'unknown')
            expect(state.reminders).toEqual({})
        })
    })

    describe('actions', () => {
        it('reset delegates to commit', () => {
            const commit = vi.fn()
            actions.reset({ commit } as any)
            expect(commit).toHaveBeenCalledWith('reset')
        })

        it('init emits database get_item', () => {
            actions.init()
            expect(mockSocket.emit).toHaveBeenCalledWith(
                'server.database.get_item',
                { namespace: 'reminders' },
                { action: 'gui/reminders/initStore' }
            )
        })

        it('initStore commits reset and initStore, removes init module', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const payload = { value: { r1: { name: 'Test' } } }
            await actions.initStore({ commit, dispatch } as any, payload)
            expect(commit).toHaveBeenCalledWith('reset')
            expect(commit).toHaveBeenCalledWith('initStore', payload)
            expect(dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'gui/reminders/init', { root: true })
        })

        it('upload emits database post_item', () => {
            actions.upload({} as any, { id: 'r1', value: { name: 'Test' } })
            expect(mockSocket.emit).toHaveBeenCalledWith('server.database.post_item', {
                namespace: 'reminders',
                key: 'r1',
                value: { name: 'Test' },
            })
        })

        it('store creates reminder with uuid and uploads', async () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = {
                reminders: {
                    'mocked-uuid': {
                        name: 'Test',
                        start_total_print_time: 0,
                        time_delta: 3600,
                        repeating: false,
                        snooze_print_hours_timestamps: [],
                        snooze_epoch_timestamps: [],
                    },
                },
            }
            await actions.store({ commit, dispatch, state: stateMock as any } as any, {
                values: { name: 'Test', start_total_print_time: 0, time_delta: 3600, repeating: false },
            })
            expect(commit).toHaveBeenCalledWith('store', {
                id: 'mocked-uuid',
                values: { name: 'Test', start_total_print_time: 0, time_delta: 3600, repeating: false },
            })
            expect(dispatch).toHaveBeenCalledWith('upload', {
                id: 'mocked-uuid',
                value: stateMock.reminders['mocked-uuid'],
            })
        })

        it('update commits and uploads', () => {
            const commit = vi.fn()
            const dispatch = vi.fn()
            const stateMock = { reminders: { r1: { name: 'Updated' } } }
            actions.update({ commit, dispatch, state: stateMock as any } as any, { id: 'r1', name: 'Updated' })
            expect(commit).toHaveBeenCalledWith('update', { id: 'r1', name: 'Updated' })
            expect(dispatch).toHaveBeenCalledWith('upload', { id: 'r1', value: stateMock.reminders['r1'] })
        })

        it('delete commits and emits delete_item', () => {
            const commit = vi.fn()
            actions.delete({ commit } as any, 'r1')
            expect(commit).toHaveBeenCalledWith('delete', 'r1')
            expect(mockSocket.emit).toHaveBeenCalledWith('server.database.delete_item', {
                namespace: 'reminders',
                key: 'r1',
            })
        })

        it('repeat updates reminder with snooze timestamps', () => {
            const dispatch = vi.fn()
            const gettersMock = {
                getReminder: vi.fn().mockReturnValue({
                    id: 'r1',
                    snooze_print_hours_timestamps: [],
                    snooze_epoch_timestamps: [],
                }),
            }
            const stateMock = { reminders: { r1: {} } }
            const rootStateMock = { server: { history: { job_totals: { total_print_time: 5000 } } } }
            const now = Date.now()
            vi.setSystemTime(now)
            actions.repeat(
                {
                    dispatch,
                    getters: gettersMock as any,
                    state: stateMock as any,
                    rootState: rootStateMock as any,
                } as any,
                { id: 'r1' }
            )
            expect(dispatch).toHaveBeenCalledWith('update', {
                id: 'r1',
                snooze_print_hours_timestamps: [5000],
                snooze_epoch_timestamps: [now],
            })
        })

        it('repeat does nothing for unknown id', () => {
            const dispatch = vi.fn()
            const stateMock = { reminders: {} }
            actions.repeat({ dispatch, state: stateMock as any } as any, { id: 'unknown' })
            expect(dispatch).not.toHaveBeenCalled()
        })
    })

    describe('getters', () => {
        it('getReminders returns all reminders with ids', () => {
            state.reminders['r1'] = {
                id: 'r1',
                name: 'Lube',
                start_total_print_time: 1000,
                time_delta: 3600,
                repeating: false,
                snooze_print_hours_timestamps: [],
                snooze_epoch_timestamps: [],
            }
            const result = (getters as any).getReminders(state)
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('r1')
            expect(result[0].name).toBe('Lube')
        })

        it('getReminder finds reminder by id', () => {
            state.reminders['r1'] = {
                id: 'r1',
                name: 'Oil',
                start_total_print_time: 1000,
                time_delta: 3600,
                repeating: false,
                snooze_print_hours_timestamps: [],
                snooze_epoch_timestamps: [],
            }
            const reminders = (getters as any).getReminders(state)
            const result = (getters as any).getReminder(state, { getReminders: reminders })('r1')
            expect(result.name).toBe('Oil')
        })

        it('getReminder returns undefined for missing id', () => {
            const reminders = (getters as any).getReminders(state)
            const result = (getters as any).getReminder(state, { getReminders: reminders })('unknown')
            expect(result).toBeUndefined()
        })

        it('getOverdueReminders filters overdue entries', () => {
            state.reminders['r1'] = {
                id: 'r1',
                name: 'Overdue',
                start_total_print_time: 1000,
                time_delta: 500,
                repeating: false,
                snooze_print_hours_timestamps: [],
                snooze_epoch_timestamps: [],
            }
            state.reminders['r2'] = {
                id: 'r2',
                name: 'Not overdue',
                start_total_print_time: 1000,
                time_delta: 10000,
                repeating: false,
                snooze_print_hours_timestamps: [],
                snooze_epoch_timestamps: [],
            }
            const rootState = { server: { history: { job_totals: { total_print_time: 2000 } } } }
            const reminders = (getters as any).getReminders(state)
            const result = (getters as any).getOverdueReminders(state, { getReminders: reminders }, rootState)
            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Overdue')
        })
    })
})
