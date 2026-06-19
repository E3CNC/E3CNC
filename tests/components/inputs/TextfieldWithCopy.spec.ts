import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'

// Mock dependencies used by TextfieldWithCopy
vi.mock('@/plugins/helpers', () => ({
    copyToClipboard: vi.fn(),
}))

vi.mock('uuid', () => ({
    v4: () => 'mocked-uuid',
}))

vi.mock('@mdi/js', () => ({
    mdiContentCopy: 'mdiContentCopy',
}))

// We'll use the real component but stub vuetify
import TextfieldWithCopy from '@/components/inputs/TextfieldWithCopy.vue'

describe('TextfieldWithCopy.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    it('renders label and value', () => {
        const wrapper = shallowMount(TextfieldWithCopy, {
            props: { label: 'API Key', value: 'abc123' },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        props: ['label', 'value', 'modelValue'],
                        template:
                            '<div class="v-text-field-stub"><slot name="append" />{{ label }}: {{ value || modelValue }}</div>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<i class="v-icon-stub"><slot /></i>',
                    },
                    'v-tooltip': {
                        name: 'VTooltip',
                        props: ['modelValue', 'openOnClick', 'openOnHover'],
                        template: '<div class="v-tooltip-stub"><span v-if="modelValue"><slot /></span></div>',
                    },
                },
            },
        })

        expect(wrapper.text()).toContain('API Key')
        expect(wrapper.text()).toContain('abc123')
    })

    it('calls copyToClipboard when copy icon is clicked', async () => {
        const { copyToClipboard } = await import('@/plugins/helpers')

        const wrapper = shallowMount(TextfieldWithCopy, {
            props: { label: 'Key', value: 'secret' },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        template: '<div class="v-text-field-stub"><slot name="append" /></div>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<i class="v-icon-stub" @click="$parent.$parent.$parent.copy && $parent.$parent.$parent.copy()"><slot /></i>',
                    },
                    'v-tooltip': {
                        name: 'VTooltip',
                        props: ['modelValue'],
                        template: '<div class="v-tooltip-stub"><span v-if="modelValue"><slot /></span></div>',
                    },
                },
            },
        })

        // Find the copy icon and click it via component method
        wrapper.vm.copy()
        await wrapper.vm.$nextTick()

        expect(copyToClipboard).toHaveBeenCalledWith('secret')
    })

    it('shows tooltip for 2 seconds after copy', async () => {
        const wrapper = shallowMount(TextfieldWithCopy, {
            props: { label: 'Key', value: 'val' },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        template: '<div class="v-text-field-stub"><slot name="append" /></div>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<i class="v-icon-stub"><slot /></i>',
                    },
                    'v-tooltip': {
                        name: 'VTooltip',
                        props: ['modelValue'],
                        template: '<div class="v-tooltip-stub"><span v-if="modelValue"><slot /></span></div>',
                    },
                },
            },
        })

        expect(wrapper.vm.isShowTooltip).toBe(false)

        wrapper.vm.copy()
        await wrapper.vm.$nextTick()

        // Tooltip should be visible
        expect(wrapper.vm.isShowTooltip).toBe(true)

        // Fast-forward 2 seconds
        vi.advanceTimersByTime(2000)
        await wrapper.vm.$nextTick()

        // Tooltip should be hidden
        expect(wrapper.vm.isShowTooltip).toBe(false)
    })

    it('generates a unique CSS class on mount', () => {
        const wrapper = shallowMount(TextfieldWithCopy, {
            props: { label: 'Key', value: 'val' },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        template: '<div class="v-text-field-stub"><slot name="append" /></div>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<i class="v-icon-stub"><slot /></i>',
                    },
                    'v-tooltip': {
                        name: 'VTooltip',
                        template: '<div class="v-tooltip-stub"><slot /></div>',
                    },
                },
            },
        })

        expect(wrapper.vm.cssClassName).toBe('textfield-with-copy-mocked-uuid')
    })
})
