import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MiscellaneousSensor from '@/components/panels/Miscellaneous/MiscellaneousSensor.vue'

vi.mock('@/plugins/helpers', () => ({
    convertName: (s: string) => s.replace(/_/g, ' '),
    unitToSymbol: (s?: string) => (s === '°C' ? 'mdi-thermometer' : 'mdi-help'),
}))

vi.mock('vuetify/components', () => ({
    VContainer: { name: 'VContainer', props: { class: String }, template: '<div class="v-container"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', props: { class: String }, template: '<div class="v-col"><slot /></div>' },
    VListSubheader: {
        name: 'VListSubheader',
        props: { class: String },
        template: '<div class="v-list-subheader"><slot /></div>',
    },
    VIcon: { name: 'VIcon', props: { size: String, icon: String }, template: '<i class="v-icon"><slot /></i>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

describe('MiscellaneousSensor.vue', () => {
    it('mounts without crashing', () => {
        const wrapper = mount(MiscellaneousSensor, { props: { name: 'test', value: 42 } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders value', () => {
        const wrapper = mount(MiscellaneousSensor, { props: { name: 'test', value: 42 } })
        expect(wrapper.text()).toContain('42')
    })

    it('renders name', () => {
        const wrapper = mount(MiscellaneousSensor, { props: { name: 'my_sensor', value: 10 } })
        expect(wrapper.text()).toContain('my sensor')
    })

    it('renders value with unit', () => {
        const wrapper = mount(MiscellaneousSensor, { props: { name: 'temp', value: 25, unit: '°C' } })
        expect(wrapper.text()).toContain('25')
        expect(wrapper.text()).toContain('°C')
    })

    it('shows -- when value is NaN', () => {
        const wrapper = mount(MiscellaneousSensor, { props: { name: 'test', value: Number.NaN } })
        expect(wrapper.text()).toContain('--')
    })

    it('renders value without unit suffix when no unit provided', () => {
        const wrapper = mount(MiscellaneousSensor, { props: { name: 'test', value: 5 } })
        // Contains value but not a unit suffix pattern
        expect(wrapper.text()).toContain('5')
        expect(wrapper.text()).not.toContain('5 undefined')
    })
})
