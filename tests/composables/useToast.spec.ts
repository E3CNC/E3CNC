import { describe, it, expect, vi } from 'vitest'
import { ToastPlugin } from '@/composables/useToast'

describe('useToast', () => {
    it('exports a plugin with install method', () => {
        expect(ToastPlugin).toBeDefined()
        expect(typeof ToastPlugin.install).toBe('function')
    })

    it('install runs without throwing', () => {
        const app = { use: vi.fn() }
        expect(() => ToastPlugin.install(app)).not.toThrow()
    })
})
