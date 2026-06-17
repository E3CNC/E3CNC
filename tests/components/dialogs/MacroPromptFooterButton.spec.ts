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

import MacroPromptFooterButton from '@/components/dialogs/MacroPromptFooterButton.vue'

describe('MacroPromptFooterButton.vue', () => {
    beforeEach(() => {
        mockDispatch.mockClear()
        mockEmit.mockClear()
    })

    it('renders without crashing', () => {
        const wrapper = mount(MacroPromptFooterButton, {
            props: {
                event: { message: 'Cancel|CANCEL|error', date: new Date(), type: 'prompt' },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('shows text from event.message', () => {
        const wrapper = mount(MacroPromptFooterButton, {
            props: {
                event: { message: 'Print File|G28', date: new Date(), type: 'prompt' },
            },
        })
        expect(wrapper.text()).toBe('Print File')
    })

    it('click dispatches server/addEvent and socket emit with the command', () => {
        const wrapper = mount(MacroPromptFooterButton, {
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
        const wrapper = mount(MacroPromptFooterButton, {
            props: {
                event: { message: 'RESUME', date: new Date(), type: 'prompt' },
            },
        })

        wrapper.findComponent({ name: 'VBtn' }).trigger('click')

        expect(mockDispatch).toHaveBeenCalledWith('server/addEvent', {
            message: 'RESUME',
            type: 'command',
        })
        expect(mockEmit).toHaveBeenCalledWith('printer.gcode.script', { script: 'RESUME' })
    })

    it('uses the parsed color from event.message', () => {
        const wrapper = mount(MacroPromptFooterButton, {
            props: {
                event: { message: 'Stop|M112|error', date: new Date(), type: 'prompt' },
            },
        })
        const btn = wrapper.findComponent({ name: 'VBtn' })
        expect(btn.props('color')).toBe('error')
    })

    it('has empty color when no color segment in message', () => {
        const wrapper = mount(MacroPromptFooterButton, {
            props: {
                event: { message: 'Home|G28', date: new Date(), type: 'prompt' },
            },
        })
        const btn = wrapper.findComponent({ name: 'VBtn' })
        expect(btn.props('color')).toBe('')
    })
})
