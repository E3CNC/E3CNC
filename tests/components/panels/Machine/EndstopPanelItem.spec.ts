import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import EndstopPanelItem from '@/components/panels/Machine/EndstopPanelItem.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VChip: {
        name: 'VChip',
        props: ['size', 'label', 'color', 'textColor'],
        template: '<span class="v-chip" :class="\'v-chip--color-\' + $props.color"><slot /></span>',
    },
}))

vi.mock('@/plugins/helpers', () => ({
    convertName: (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
}))

describe('EndstopPanelItem.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(EndstopPanelItem, {
            props: {
                item: { name: 'x', type: 'endstop', value: 'open' },
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the endstop label with uppercase name for endstop type', () => {
        const wrapper = mount(EndstopPanelItem, {
            props: {
                item: { name: 'x', type: 'endstop', value: 'open' },
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.EndstopPanel.Endstop')
        expect(wrapper.text()).toContain('X')
    })

    it('renders converted name for probe type', () => {
        const wrapper = mount(EndstopPanelItem, {
            props: {
                item: { name: 'my_probe', type: 'probe', value: 'open' },
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('My Probe')
    })

    it('renders success chip when value is open', () => {
        const wrapper = mount(EndstopPanelItem, {
            props: {
                item: { name: 'x', type: 'endstop', value: 'open' },
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const chip = wrapper.find('.v-chip')
        expect(chip.classes()).toContain('v-chip--color-success')
        expect(chip.text()).toBe('Machine.EndstopPanel.open')
    })

    it('renders error chip when value is TRIGGERED', () => {
        const wrapper = mount(EndstopPanelItem, {
            props: {
                item: { name: 'x', type: 'endstop', value: 'TRIGGERED' },
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const chip = wrapper.find('.v-chip')
        expect(chip.classes()).toContain('v-chip--color-error')
        expect(chip.text()).toBe('Machine.EndstopPanel.TRIGGERED')
    })
})
