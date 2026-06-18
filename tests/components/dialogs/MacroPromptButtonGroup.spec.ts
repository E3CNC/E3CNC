import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
}))

vi.mock('@/components/dialogs/MacroPromptButton.vue', () => ({
    default: {
        name: 'MacroPromptButton',
        props: ['event'],
        template: '<button class="macro-prompt-btn">{{ event?.message }}</button>',
    },
}))

import MacroPromptButtonGroup from '@/components/dialogs/MacroPromptButtonGroup.vue'

describe('MacroPromptButtonGroup.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(MacroPromptButtonGroup, {
            props: { children: [], groupIndex: 0 },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders child buttons', () => {
        const wrapper = mount(MacroPromptButtonGroup, {
            props: {
                children: [
                    { date: new Date(), type: 'button', message: 'Confirm' },
                    { date: new Date(), type: 'button', message: 'Cancel' },
                ],
                groupIndex: 0,
            },
        })
        const buttons = wrapper.findAll('.macro-prompt-btn')
        expect(buttons.length).toBe(2)
        expect(buttons[0].text()).toBe('Confirm')
        expect(buttons[1].text()).toBe('Cancel')
    })

    it('renders single button', () => {
        const wrapper = mount(MacroPromptButtonGroup, {
            props: {
                children: [{ date: new Date(), type: 'button', message: 'OK' }],
                groupIndex: 1,
            },
        })
        expect(wrapper.find('.macro-prompt-btn').text()).toBe('OK')
    })
})
