/**
 * Tests for src/store/socket/getters.ts
 * 
 * Tests the socket store getters which compute URLs for WebSocket connections.
 */

import { describe, it, expect } from 'vitest'
import { getters } from '@/store/socket/getters'
import type { SocketState } from '@/store/socket/types'

describe('socket getters', () => {
    describe('getUrl', () => {
        it('returns URL with hostname and port', () => {
            const state = {
                hostname: 'myprinter.local',
                port: 8080,
                path: '',
            } as SocketState

            const result = (getters as any).getUrl(state)
            expect(result).toBe('//myprinter.local:8080')
        })

        it('omits port when it is 80', () => {
            const state = {
                hostname: 'myprinter.local',
                port: 80,
                path: '',
            } as SocketState

            const result = (getters as any).getUrl(state)
            expect(result).toBe('//myprinter.local')
        })

        it('includes path', () => {
            const state = {
                hostname: 'myprinter.local',
                port: 8080,
                path: 'mainsail',
            } as SocketState

            const result = (getters as any).getUrl(state)
            expect(result).toBe('//myprinter.local:8080/mainsail')
        })

        it('strips leading and trailing slashes from path', () => {
            const state = {
                hostname: 'myprinter.local',
                port: 80,
                path: '/mainsail/',
            } as SocketState

            const result = (getters as any).getUrl(state)
            expect(result).toBe('//myprinter.local/mainsail')
        })

        it('handles empty path', () => {
            const state = {
                hostname: 'localhost',
                port: 80,
                path: '',
            } as SocketState

            const result = (getters as any).getUrl(state)
            expect(result).toBe('//localhost')
        })
    })

    describe('getHostUrl', () => {
        it('returns http URL for ws protocol', () => {
            const state = {
                hostname: 'myprinter.local',
                protocol: 'ws',
            } as SocketState

            const result = (getters as any).getHostUrl(state)
            expect(result).toBe('http://myprinter.local/')
        })

        it('returns https URL for wss protocol', () => {
            const state = {
                hostname: 'myprinter.local',
                protocol: 'wss',
            } as SocketState

            const result = (getters as any).getHostUrl(state)
            expect(result).toBe('https://myprinter.local/')
        })
    })

    describe('getWebsocketUrl', () => {
        it('returns full websocket URL', () => {
            const state = {
                hostname: 'myprinter.local',
                port: 8080,
                path: '',
                protocol: 'ws',
            } as SocketState

            const localGetters = {
                getUrl: '//myprinter.local:8080',
            }

            const result = (getters as any).getWebsocketUrl(state, localGetters)
            expect(result).toBe('ws://myprinter.local:8080/websocket')
        })

        it('returns wss URL for secure protocol', () => {
            const state = {
                hostname: 'myprinter.local',
                port: 443,
                path: '',
                protocol: 'wss',
            } as SocketState

            const localGetters = {
                getUrl: '//myprinter.local:443',
            }

            const result = (getters as any).getWebsocketUrl(state, localGetters)
            expect(result).toBe('wss://myprinter.local:443/websocket')
        })
    })
})
