/**
 * Tests for src/composables/useSocket.ts
 * 
 * Tests the socket composable which provides WebSocket access via Vue injection.
 */

import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, inject } from 'vue'
import { mount } from '@vue/test-utils'
import { useSocket, SOCKET_KEY } from '@/composables/useSocket'

describe('useSocket', () => {
    it('throws when socket is not provided', () => {
        const TestComponent = defineComponent({
            setup() {
                useSocket()
                return () => h('div')
            },
        })

        expect(() => {
            mount(TestComponent)
        }).toThrow('useSocket() called without providing socket')
    })

    it('returns the injected socket instance', () => {
        const mockSocket = {
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            close: vi.fn(),
        }

        let result: any = null

        const TestComponent = defineComponent({
            setup() {
                result = useSocket()
                return () => h('div')
            },
        })

        mount(TestComponent, {
            global: {
                provide: {
                    [SOCKET_KEY as symbol]: mockSocket,
                },
            },
        })

        expect(result).toBe(mockSocket)
        expect(result.emit).toBe(mockSocket.emit)
    })

    it('SOCKET_KEY is a Symbol', () => {
        expect(typeof SOCKET_KEY).toBe('symbol')
    })
})
