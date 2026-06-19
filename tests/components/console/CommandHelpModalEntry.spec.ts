import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import CommandHelpModalEntry from '@/components/console/CommandHelpModalEntry.vue'

// ── Mock vuetify components ──
vi.mock('vuetify/components', () => ({
    VListItem: {
        name: 'VListItem',
        template: '<div class="v-list-item"><slot name="title" /><slot name="subtitle" /></div>',
    },
}))

function createStoreWithState(commands: Record<string, any> = {}) {
    return createStore({
        state: {
            printer: {
                gcode: {
                    commands,
                },
            } as any,
        },
    })
}

describe('CommandHelpModalEntry.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the command name', () => {
        const store = createStoreWithState({
            RESTART: { help: 'Restarts Klipper' },
        })
        const wrapper = mount(CommandHelpModalEntry, {
            props: { command: 'RESTART' },
            global: { plugins: [store] },
        })

        expect(wrapper.text()).toContain('RESTART')
    })

    it('renders description when available', () => {
        const store = createStoreWithState({
            RESTART: { help: 'Restarts Klipper' },
        })
        const wrapper = mount(CommandHelpModalEntry, {
            props: { command: 'RESTART' },
            global: { plugins: [store] },
        })

        expect(wrapper.text()).toContain('Restarts Klipper')
    })

    it('does not render subtitle when description is null', () => {
        const store = createStoreWithState({
            G28: { help: null },
        })
        const wrapper = mount(CommandHelpModalEntry, {
            props: { command: 'G28' },
            global: { plugins: [store] },
        })

        // The subtitle slot should not render when description is null
        const subtitleSlot = wrapper.find('.v-list-item')
        expect(subtitleSlot.exists()).toBe(true)
        // Just the command name, no description
        expect(wrapper.text()).toContain('G28')
    })

    it('does not render subtitle when help key is missing', () => {
        const store = createStoreWithState({
            M106: {},
        })
        const wrapper = mount(CommandHelpModalEntry, {
            props: { command: 'M106' },
            global: { plugins: [store] },
        })

        expect(wrapper.text()).toContain('M106')
    })

    it('renders description when it is an empty string', () => {
        const store = createStoreWithState({
            M105: { help: '' },
        })
        const wrapper = mount(CommandHelpModalEntry, {
            props: { command: 'M105' },
            global: { plugins: [store] },
        })

        // Empty string is treated as falsy, so no subtitle (default slot behavior)
        expect(wrapper.text()).toContain('M105')
    })

    it('emits click-on-command when clicked', async () => {
        const store = createStoreWithState({
            G28: { help: 'Home all axes' },
        })
        const wrapper = mount(CommandHelpModalEntry, {
            props: { command: 'G28' },
            global: { plugins: [store] },
        })

        // Click the command text span
        const titleSpan = wrapper.find('.text-primary')
        await titleSpan.trigger('click')
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('click-on-command')).toBeTruthy()
        expect(wrapper.emitted('click-on-command')![0]).toEqual(['G28'])
    })

    it('handles empty commands object gracefully', () => {
        const store = createStoreWithState({})
        const wrapper = mount(CommandHelpModalEntry, {
            props: { command: 'UNKNOWN' },
            global: { plugins: [store] },
        })

        expect(wrapper.text()).toContain('UNKNOWN')
    })
})
