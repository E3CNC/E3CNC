import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCncOffsets } from '@/composables/useCncOffsets'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'

const mockGetCncWcs = vi.fn()
const mockSelectCncWcs = vi.fn()

vi.mock('@/store/files/cncApi', () => ({
    getCncWcs: (...args: any[]) => mockGetCncWcs(...args),
    selectCncWcs: (...args: any[]) => mockSelectCncWcs(...args),
}))

function mountComposable() {
    const store = createStore({
        getters: {
            'socket/getUrl': () => '//localhost:8080',
        },
    })

    let result: any
    const TestComponent = {
        template: '<div></div>',
        setup() {
            result = useCncOffsets()
            return {}
        },
    }
    mount(TestComponent, { global: { plugins: [store] } })
    return result
}

describe('useCncOffsets', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('exports offsetNames', () => {
        const c = mountComposable()
        expect(c.offsetNames).toEqual(['G54', 'G55', 'G56', 'G57', 'G58', 'G59'])
    })

    it('has default activeWcs of G54', () => {
        const c = mountComposable()
        expect(c.activeWcs.value).toBe('G54')
    })

    it('has default wcsOffsets of empty object', () => {
        const c = mountComposable()
        expect(c.wcsOffsets.value).toEqual({})
    })

    it('refreshWcs fetches and maps WCS data', async () => {
        mockGetCncWcs.mockResolvedValue({
            result: { active: 'G55', offsets: { G54: { X: 1, Y: 2, Z: 3 } } },
        })
        const c = mountComposable()
        await c.refreshWcs()
        expect(mockGetCncWcs).toHaveBeenCalledWith('//localhost:8080')
        expect(c.activeWcs.value).toBe('G55')
        expect(c.wcsOffsets.value).toEqual({ G54: { X: 1, Y: 2, Z: 3 } })
    })

    it('refreshWcs falls back to raw result if no .result property', async () => {
        mockGetCncWcs.mockResolvedValue({
            active: 'G56',
            offsets: { G54: { X: 10, Y: 20, Z: 30 } },
        })
        const c = mountComposable()
        await c.refreshWcs()
        expect(c.activeWcs.value).toBe('G56')
        expect(c.wcsOffsets.value).toEqual({ G54: { X: 10, Y: 20, Z: 30 } })
    })

    it('refreshWcs defaults active to G54 when missing', async () => {
        mockGetCncWcs.mockResolvedValue({ result: {} })
        const c = mountComposable()
        await c.refreshWcs()
        expect(c.activeWcs.value).toBe('G54')
    })

    it('refreshWcs does not clear offsets when API returns none', async () => {
        mockGetCncWcs.mockResolvedValue({
            result: { active: 'G54', offsets: { G54: { X: 1, Y: 2, Z: 3 } } },
        })
        const c = mountComposable()
        await c.refreshWcs()
        expect(c.wcsOffsets.value).toEqual({ G54: { X: 1, Y: 2, Z: 3 } })
        // second call without offsets should not clear
        mockGetCncWcs.mockResolvedValue({ result: { active: 'G55' } })
        await c.refreshWcs()
        expect(c.wcsOffsets.value).toEqual({ G54: { X: 1, Y: 2, Z: 3 } })
    })

    it('refreshWcs defaults X/Y/Z to 0 when missing in offset', async () => {
        mockGetCncWcs.mockResolvedValue({
            result: {
                active: 'G54',
                offsets: { G54: {} },
            },
        })
        const c = mountComposable()
        await c.refreshWcs()
        expect(c.wcsOffsets.value).toEqual({ G54: { X: 0, Y: 0, Z: 0 } })
    })

    it('setActiveWcs skips when already active', async () => {
        const c = mountComposable()
        c.activeWcs.value = 'G54'
        await c.setActiveWcs('G54')
        expect(mockSelectCncWcs).not.toHaveBeenCalled()
    })

    it('setActiveWcs calls selectCncWcs when different', async () => {
        const c = mountComposable()
        c.activeWcs.value = 'G54'
        mockSelectCncWcs.mockResolvedValue(null)
        await c.setActiveWcs('G55')
        expect(mockSelectCncWcs).toHaveBeenCalledWith('//localhost:8080', { wcs: 'G55' })
        expect(c.activeWcs.value).toBe('G55')
    })
})
