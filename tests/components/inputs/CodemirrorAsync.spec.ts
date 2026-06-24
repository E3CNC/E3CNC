import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CodemirrorAsync from '@/components/inputs/CodemirrorAsync.vue'

const mockCodemirror = vi.hoisted(() => ({
    default: {
        name: 'Codemirror',
        props: ['modelValue', 'validationErrors'],
        template: '<div class="codemirror-stub"><slot /></div>',
    },
}))

vi.mock('@/components/inputs/Codemirror.vue', () => mockCodemirror)

describe('CodemirrorAsync.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders nothing initially before dynamic import resolves', () => {
        const wrapper = mount(CodemirrorAsync, {
            props: { modelValue: 'test' },
        })
        // Before mount await, the dynamic component should not be rendered
        expect(wrapper.find('.codemirror-stub').exists()).toBe(false)
    })

    it('loads and renders Codemirror component after mount', async () => {
        const wrapper = mount(CodemirrorAsync, {
            props: { modelValue: 'test' },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()

        const codemirror = wrapper.findComponent({ name: 'Codemirror' })
        expect(codemirror.exists()).toBe(true)
        expect(codemirror.props('modelValue')).toBe('test')
    })

    it('passes validation errors to Codemirror', async () => {
        const validationErrors = [
            { line: 5, severity: 'error' as const },
            { line: 10, severity: 'warning' as const },
        ]
        const wrapper = mount(CodemirrorAsync, {
            props: { modelValue: 'test', validationErrors },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()

        const codemirror = wrapper.findComponent({ name: 'Codemirror' })
        expect(codemirror.exists()).toBe(true)
        expect(codemirror.props('validationErrors')).toEqual(validationErrors)
    })

    it('exposes gotoLine function', () => {
        const wrapper = mount(CodemirrorAsync, {
            props: { modelValue: 'test' },
        })
        expect(typeof wrapper.vm.gotoLine).toBe('function')
    })
})
