import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExports: Record<string, any> = {}

vi.mock('vue-toast-notification', () => ({
    get default() {
        return mockExports.default
    },
    get ToastPlugin() {
        return mockExports.ToastPlugin
    },
}))

beforeEach(() => {
    Object.keys(mockExports).forEach((k) => delete mockExports[k])
})

describe('useToast', () => {
    it('exports a plugin with install method', async () => {
        const { ToastPlugin } = await import('@/composables/useToast')
        expect(ToastPlugin).toBeDefined()
        expect(typeof ToastPlugin.install).toBe('function')
    })

    it('install runs without throwing', async () => {
        const { ToastPlugin } = await import('@/composables/useToast')
        const app: any = { use: vi.fn() }
        expect(() => (ToastPlugin as any).install(app)).not.toThrow()
    })

    it('uses mod.default when available', async () => {
        const mockPlugin = { install: vi.fn() }
        mockExports.default = mockPlugin

        vi.resetModules()
        const { ToastPlugin } = await import('@/composables/useToast')
        const app: any = { use: vi.fn() }
        ;(ToastPlugin as any).install(app)

        await new Promise((r) => setTimeout(r, 10))
        expect(app.use).toHaveBeenCalledWith(mockPlugin, {
            duration: 3000,
            position: 'top-right',
        })
    })

    it('falls back to mod.ToastPlugin when default is undefined', async () => {
        const mockPlugin = { install: vi.fn() }
        mockExports.default = undefined
        mockExports.ToastPlugin = mockPlugin

        vi.resetModules()
        const { ToastPlugin } = await import('@/composables/useToast')
        const app: any = { use: vi.fn() }
        ;(ToastPlugin as any).install(app)

        await new Promise((r) => setTimeout(r, 10))
        expect(app.use).toHaveBeenCalledWith(mockPlugin, {
            duration: 3000,
            position: 'top-right',
        })
    })

    it('falls back to mod itself when default and ToastPlugin are undefined', async () => {
        mockExports.default = undefined
        mockExports.ToastPlugin = undefined

        vi.resetModules()
        const { ToastPlugin } = await import('@/composables/useToast')
        const app: any = { use: vi.fn() }
        ;(ToastPlugin as any).install(app)

        await new Promise((r) => setTimeout(r, 10))
        expect(app.use).toHaveBeenCalled()
    })
})
