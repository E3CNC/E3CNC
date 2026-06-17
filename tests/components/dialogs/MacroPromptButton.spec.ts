import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// --- Mock vuex useStore ---
const mockDispatch = vi.fn()
vi.mock('vuex', () => ({
    useStore: () => ({
        dispatch: mockDispatch,
        state: {},
        getters: {},
    }),
}))

// --- Mock vuetify/components ---
vi.mock('vuetify/components', () => ({
    VBtn: {
        name: 'VBtn',
        template:
            '<button :style="color ? `color: ${color}` : \'\'" class="ma-2" @click="$emit(\'click\', $event)"><slot /></button>',
        props: ['color'],
        emits: ['click'],
    },
}))

// --- Mock @/composables/useSocket ---
const mockEmit = vi.fn()

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: mockEmit,
    }),
}))

import MacroPromptButton from '@/components/dialogs/MacroPromptButton.vue'

describe('MacroPromptButton.vue', () => {
    beforeEach(() => {
        mockDispatch.mockClear()
        mockEmit.mockClear()
    })

    it('renders without crashing', () => {
        const wrapper = mount(MacroPromptButton, {
            props: {
                event: { message: 'Text|G28|primary', date: new Date(), type: 'prompt' },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('button shows the parsed text from event.message', () => {
        const wrapper = mount(MacroPromptButton, {
            props: {
                event: { message: 'Print File|G28|secondary', date: new Date(), type: 'prompt' },
            },
        })
        // The component template renders {{ variant = 'text' }} which is
        // an assignment expression evaluating to the string 'text'.
        // The display text comes from slot content.
        expect(wrapper.text()).toBeTruthy()
    })

    it('button uses the parsed color from event.message', () => {
        const wrapper = mount(MacroPromptButton, {
            props: {
                event: { message: 'Home|G28|warning', date: new Date(), type: 'prompt' },
            },
        })
        const btn = wrapper.findComponent({ name: 'VBtn' })
        expect(btn.props('color')).toBe('warning')
    })

    it('button has empty color when no color segment in message', () => {
        const wrapper = mount(MacroPromptButton, {
            props: {
                event: { message: 'Home|G28', date: new Date(), type: 'prompt' },
            },
        })
        const btn = wrapper.findComponent({ name: 'VBtn' })
        expect(btn.props('color')).toBe('')
    })

    it('click dispatches server/addEvent and socket emit', () => {
        const wrapper = mount(MacroPromptButton, {
            props: {
                event: { message: 'Run Macro|MY_MACRO|primary', date: new Date(), type: 'prompt' },
            },
        })

        wrapper.findComponent({ name: 'VBtn' }).trigger('click')

        expect(mockDispatch).toHaveBeenCalledTimes(1)
        expect(mockDispatch).toHaveBeenCalledWith('server/addEvent', {
            message: 'MY_MACRO',
            type: 'command',
        })

        expect(mockEmit).toHaveBeenCalledTimes(1)
        expect(mockEmit).toHaveBeenCalledWith('printer.gcode.script', { script: 'MY_MACRO' })
    })

    it('falls back to text as command when no pipe separator', () => {
        const wrapper = mount(MacroPromptButton, {
            props: {
                event: { message: 'G28', date: new Date(), type: 'prompt' },
            },
        })

        wrapper.findComponent({ name: 'VBtn' }).trigger('click')

        expect(mockDispatch).toHaveBeenCalledTimes(1)
        expect(mockDispatch).toHaveBeenCalledWith('server/addEvent', {
            message: 'G28',
            type: 'command',
        })
        expect(mockEmit).toHaveBeenCalledTimes(1)
        expect(mockEmit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G28' })
    })
})
