import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import MoveToInput from '@/components/inputs/MoveToInput.vue'

describe('MoveToInput.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the label and current position as suffix placeholder', () => {
        const wrapper = shallowMount(MoveToInput, {
            props: {
                position: '150.0',
                currentPos: '150.0',
                label: 'X',
                suffix: 'mm',
            },
            global: {
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        props: ['label', 'modelValue', 'suffix', 'disabled'],
                        template:
                            '<div class="v-text-field-stub">{{ label }} {{ modelValue }} {{ suffix }}</div>',
                    },
                },
            },
        })

        expect(wrapper.text()).toContain('[ X ]')
        expect(wrapper.text()).toContain('150.0')
        expect(wrapper.text()).toContain('mm')
    })

    it('emits update:position when v-model changes', async () => {
        const wrapper = shallowMount(MoveToInput, {
            props: {
                position: '100.0',
                currentPos: '100.0',
                label: 'Y',
            },
            global: {
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        props: ['modelValue'],
                        template: '<input class="v-text-field-stub" :value="modelValue" />',
                    },
                },
            },
        })

        // Update the computed position by triggering the setter
        wrapper.vm.position = '200.0'
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('update:position')).toBeTruthy()
        expect(wrapper.emitted('update:position')![0]).toEqual(['200.0'])
    })

    it('emits submit on form submission', async () => {
        const wrapper = shallowMount(MoveToInput, {
            props: {
                position: '150.0',
                currentPos: '150.0',
            },
            global: {
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        template: '<input class="v-text-field-stub" />',
                    },
                },
            },
        })

        wrapper.vm.submit()
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('submit')).toBeTruthy()
    })

    it('resets position to currentPos on blur when changed', () => {
        const wrapper = shallowMount(MoveToInput, {
            props: {
                position: '100.0',
                currentPos: '150.0',
            },
            global: {
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        props: ['modelValue'],
                        template: '<input class="v-text-field-stub" :value="modelValue" />',
                    },
                },
            },
        })

        wrapper.vm.onBlur()

        expect(wrapper.emitted('update:position')).toBeTruthy()
        expect(wrapper.emitted('update:position')![0]).toEqual(['150.0'])
    })

    it('does not emit update:position on blur when position matches currentPos', () => {
        const wrapper = shallowMount(MoveToInput, {
            props: {
                position: '150.0',
                currentPos: '150.0',
            },
            global: {
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        template: '<input class="v-text-field-stub" />',
                    },
                },
            },
        })

        wrapper.vm.onBlur()

        expect(wrapper.emitted('update:position')).toBeFalsy()
    })

    it('passes disabled prop to text field', () => {
        const wrapper = shallowMount(MoveToInput, {
            props: {
                position: '0',
                currentPos: '0',
                disabled: true,
            },
            global: {
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        props: ['disabled'],
                        template: '<div class="v-text-field-stub" :data-disabled="disabled" />',
                    },
                },
            },
        })

        const field = wrapper.find('.v-text-field-stub')
        expect(field.attributes('data-disabled')).toBe('true')
    })
})
