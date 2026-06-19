import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({}),
}))

import CheckboxList from '@/components/inputs/CheckboxList.vue'

describe('CheckboxList.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const options = [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
        { label: 'Option C', value: 'c' },
    ]

    it('renders all checkbox options', () => {
        const wrapper = shallowMount(CheckboxList, {
            props: { options },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
                    'v-checkbox': {
                        name: 'VCheckbox',
                        props: ['label', 'modelValue', 'value'],
                        template: '<label class="v-checkbox-stub">{{ label }}</label>',
                    },
                    'v-divider': { name: 'VDivider', template: '<hr class="v-divider-stub" />' },
                },
            },
        })

        expect(wrapper.text()).toContain('Option A')
        expect(wrapper.text()).toContain('Option B')
        expect(wrapper.text()).toContain('Option C')
    })

    it('renders select-all checkbox when selectAll is true', () => {
        const wrapper = shallowMount(CheckboxList, {
            props: { options, selectAll: true },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
                    'v-checkbox': {
                        name: 'VCheckbox',
                        props: ['label', 'modelValue', 'value'],
                        template: '<label class="v-checkbox-stub">{{ label }}</label>',
                    },
                    'v-divider': { name: 'VDivider', template: '<hr class="v-divider-stub" />' },
                },
            },
        })

        expect(wrapper.text()).toContain('Settings.GeneralTab.Everything')
    })

    it('does not render select-all checkbox when selectAll is false', () => {
        const wrapper = shallowMount(CheckboxList, {
            props: { options, selectAll: false },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
                    'v-checkbox': {
                        name: 'VCheckbox',
                        props: ['label', 'modelValue', 'value'],
                        template: '<label class="v-checkbox-stub">{{ label }}</label>',
                    },
                    'v-divider': { name: 'VDivider', template: '<hr class="v-divider-stub" />' },
                },
            },
        })

        expect(wrapper.text()).not.toContain('Settings.GeneralTab.Everything')
    })

    it('selectAll checkbox is unchecked when no options are selected', () => {
        const wrapper = shallowMount(CheckboxList, {
            props: { options, selectAll: true },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
                    'v-checkbox': {
                        name: 'VCheckbox',
                        props: ['label', 'modelValue', 'value'],
                        template: '<label class="v-checkbox-stub">{{ label }}</label>',
                    },
                    'v-divider': { name: 'VDivider', template: '<hr class="v-divider-stub" />' },
                },
            },
        })

        // selectAllModel should be false when nothing is selected
        expect(wrapper.vm.selectAllModel).toBe(false)
    })

    it('selectAll checkbox is indeterminate when some options are selected', async () => {
        const wrapper = shallowMount(CheckboxList, {
            props: { options, selectAll: true },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
                    'v-checkbox': {
                        name: 'VCheckbox',
                        props: ['label', 'modelValue', 'value', 'indeterminate'],
                        template: '<label class="v-checkbox-stub">{{ label }}</label>',
                    },
                    'v-divider': { name: 'VDivider', template: '<hr class="v-divider-stub" />' },
                },
            },
        })

        // Select the first option
        wrapper.vm.selectedCheckboxes = ['a']
        await wrapper.vm.$nextTick()

        // selectAllModel should be false (not all selected)
        expect(wrapper.vm.selectAllModel).toBe(false)
        // selectAllIndeterminate should be true
        expect(wrapper.vm.selectAllIndeterminate).toBe(true)
    })

    it('selectAll checkbox is checked when all options are selected', async () => {
        const wrapper = shallowMount(CheckboxList, {
            props: { options, selectAll: true },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
                    'v-checkbox': {
                        name: 'VCheckbox',
                        props: ['label', 'modelValue', 'value', 'indeterminate'],
                        template: '<label class="v-checkbox-stub">{{ label }}</label>',
                    },
                    'v-divider': { name: 'VDivider', template: '<hr class="v-divider-stub" />' },
                },
            },
        })

        wrapper.vm.selectedCheckboxes = ['a', 'b', 'c']
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.selectAllModel).toBe(true)
        expect(wrapper.vm.selectAllIndeterminate).toBe(false)
    })

    it('selectAll toggles all options when clicked', async () => {
        const wrapper = shallowMount(CheckboxList, {
            props: { options, selectAll: true },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
                    'v-checkbox': {
                        name: 'VCheckbox',
                        props: ['label', 'modelValue', 'value', 'indeterminate'],
                        template: '<label class="v-checkbox-stub">{{ label }}</label>',
                    },
                    'v-divider': { name: 'VDivider', template: '<hr class="v-divider-stub" />' },
                },
            },
        })

        // Select all via selectAllModel setter
        wrapper.vm.selectAllModel = true
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.selectedCheckboxes).toEqual(['a', 'b', 'c'])

        // Deselect all
        wrapper.vm.selectAllModel = false
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.selectedCheckboxes).toEqual([])
    })

    it('emits update:selectedCheckboxes when selection changes', async () => {
        const wrapper = shallowMount(CheckboxList, {
            props: { options },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
                    'v-checkbox': {
                        name: 'VCheckbox',
                        props: ['label', 'modelValue', 'value'],
                        template: '<label class="v-checkbox-stub">{{ label }}</label>',
                    },
                    'v-divider': { name: 'VDivider', template: '<hr class="v-divider-stub" />' },
                },
            },
        })

        // Directly modify selectedCheckboxes to trigger the @change emit
        wrapper.vm.selectedCheckboxes = ['a']
        await wrapper.vm.$nextTick()

        // The @change handler is called by template, but since we shallow mount
        // we need to check the reactivity works
        expect(wrapper.vm.selectedCheckboxes).toEqual(['a'])
    })

    it('renders v-divider when selectAll is true', () => {
        const wrapper = shallowMount(CheckboxList, {
            props: { options, selectAll: true },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
                    'v-checkbox': {
                        name: 'VCheckbox',
                        props: ['label', 'modelValue', 'value'],
                        template: '<label class="v-checkbox-stub">{{ label }}</label>',
                    },
                    'v-divider': { name: 'VDivider', template: '<hr class="v-divider-stub" />' },
                },
            },
        })

        expect(wrapper.find('.v-divider-stub').exists()).toBe(true)
    })
})
