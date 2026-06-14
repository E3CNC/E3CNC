/**
 * Tests for src/store/socket/mutations.ts
 * 
 * Tests the socket store mutations which manage connection state,
 * loading indicators, and initialization modules.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mutations } from '@/store/socket/mutations'
import { getDefaultState } from '@/store/socket/index'
import type { SocketState } from '@/store/socket/types'

describe('socket mutations', () => {
    let state: SocketState

    beforeEach(() => {
        state = getDefaultState()
    })

    describe('reset', () => {
        it('resets initializationList to defaults', () => {
            state.initializationList = ['server', 'printer', 'gui']
            mutations.reset(state)
            expect(state.initializationList).toEqual(['server'])
        })
    })

    describe('setConnected', () => {
        it('sets connection state to connected', () => {
            state.isConnected = false
            state.isConnecting = true
            state.connectingFailed = true

            mutations.setConnected(state)

            expect(state.isConnected).toBe(true)
            expect(state.isConnecting).toBe(false)
            expect(state.connectingFailed).toBe(false)
        })
    })

    describe('setDisconnected', () => {
        it('sets connection state to disconnected', () => {
            state.isConnected = true
            state.isConnecting = false
            state.connection_id = 12345

            mutations.setDisconnected(state)

            expect(state.isConnected).toBe(false)
            expect(state.isConnecting).toBe(false)
            expect(state.connectingFailed).toBe(true)
            expect(state.connection_id).toBeNull()
        })

        it('sets connection failed message when provided', () => {
            mutations.setDisconnected(state, 'Connection refused')
            expect(state.connectionFailedMessage).toBe('Connection refused')
        })

        it('does not set message when not provided', () => {
            state.connectionFailedMessage = 'previous error'
            mutations.setDisconnected(state)
            // message stays as previous since no new message provided
            expect(state.connectionFailedMessage).toBe('previous error')
        })
    })

    describe('setData', () => {
        it('updates state properties from payload', () => {
            mutations.setData(state, { hostname: 'newhost', port: 9999 })
            expect(state.hostname).toBe('newhost')
            expect(state.port).toBe(9999)
        })

        it('handles nested socket payload', () => {
            mutations.setData(state, { socket: { hostname: 'nested' } })
            expect(state.hostname).toBe('nested')
        })
    })

    describe('addLoading', () => {
        it('adds loading name to loadings array', () => {
            mutations.addLoading(state, { name: 'homeAll' })
            expect(state.loadings).toContain('homeAll')
        })

        it('allows duplicate loading names', () => {
            mutations.addLoading(state, { name: 'test' })
            mutations.addLoading(state, { name: 'test' })
            expect(state.loadings.filter((l) => l === 'test').length).toBe(2)
        })
    })

    describe('removeLoading', () => {
        it('removes loading name from loadings array', () => {
            state.loadings = ['homeAll', 'homeX']
            mutations.removeLoading(state, { name: 'homeAll' })
            expect(state.loadings).toEqual(['homeX'])
        })

        it('does nothing if loading name not found', () => {
            state.loadings = ['homeAll']
            mutations.removeLoading(state, { name: 'nonexistent' })
            expect(state.loadings).toEqual(['homeAll'])
        })
    })

    describe('clearLoadings', () => {
        it('clears all loadings', () => {
            state.loadings = ['homeAll', 'homeX', 'homeY']
            mutations.clearLoadings(state)
            expect(state.loadings).toEqual([])
        })

        it('does nothing if loadings already empty', () => {
            state.loadings = []
            mutations.clearLoadings(state)
            expect(state.loadings).toEqual([])
        })
    })

    describe('addInitModule', () => {
        it('adds module to initialization list', () => {
            mutations.addInitModule(state, 'printer')
            expect(state.initializationList).toContain('printer')
        })

        it('does not add duplicate modules', () => {
            state.initializationList = ['server']
            mutations.addInitModule(state, 'server')
            expect(state.initializationList.filter((m) => m === 'server').length).toBe(1)
        })
    })

    describe('removeInitModule', () => {
        it('removes module from initialization list', () => {
            state.initializationList = ['server', 'printer', 'gui']
            mutations.removeInitModule(state, 'printer')
            expect(state.initializationList).toEqual(['server', 'gui'])
        })

        it('does nothing if module not found', () => {
            state.initializationList = ['server']
            mutations.removeInitModule(state, 'nonexistent')
            expect(state.initializationList).toEqual(['server'])
        })
    })

    describe('removeInitComponent', () => {
        it('removes all components starting with prefix', () => {
            state.initializationList = ['server', 'printer/history', 'printer/power', 'gui']
            mutations.removeInitComponent(state, 'printer/')
            expect(state.initializationList).toEqual(['server', 'gui'])
        })

        it('does nothing if no matching prefix', () => {
            state.initializationList = ['server', 'printer']
            mutations.removeInitComponent(state, 'nonexistent/')
            expect(state.initializationList).toEqual(['server', 'printer'])
        })
    })
})
