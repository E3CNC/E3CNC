import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
}))

import MacroPromptText from '@/components/dialogs/MacroPromptText.vue'

describe('MacroPromptText.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(MacroPromptText, {
            props: { event: { date: new Date(), type: 'text', message: 'Hello World' } },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the message text', () => {
        const wrapper = mount(MacroPromptText, {
            props: { event: { date: new Date(), type: 'text', message: 'Are you sure?' } },
        })
        expect(wrapper.text()).toContain('Are you sure?')
    })

    it('renders empty text when message is empty', () => {
        const wrapper = mount(MacroPromptText, {
            props: { event: { date: new Date(), type: 'text', message: '' } },
        })
        expect(wrapper.text()).toBe('')
    })
})
