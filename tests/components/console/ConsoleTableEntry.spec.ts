import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import ConsoleTableEntry from '@/components/console/ConsoleTableEntry.vue'
import type { ServerStateEvent } from '@/store/server/types'

// ── Mock vuetify VRow/VCol (used directly in template) ──
vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
}))

// ── Mock formatTime in useBase ──
const mockFormatTime = vi.fn((_timestamp: number, _boolSeconds: boolean) => '10:30 AM')

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        formatTime: mockFormatTime,
    }),
}))

interface StoreOverrides {
    entryStyle?: string
    rawOutput?: boolean
}

function createStoreWithState(overrides: StoreOverrides = {}) {
    return createStore({
        state: {
            gui: {
                console: {
                    entryStyle: overrides.entryStyle ?? 'default',
                    rawOutput: overrides.rawOutput ?? false,
                },
            } as any,
        },
    })
}

function makeEvent(overrides: Partial<ServerStateEvent> = {}): ServerStateEvent {
    return {
        date: new Date('2024-01-15T10:30:00'),
        type: 'message',
        message: 'Hello world',
        formatMessage: 'Hello world',
        ...overrides,
    }
}

describe('ConsoleTableEntry.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ── Basic rendering ──
    it('renders the formatted time and message', () => {
        const store = createStoreWithState()
        const event = makeEvent()
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        expect(wrapper.text()).toContain('10:30 AM')
        expect(wrapper.text()).toContain('Hello world')
    })

    it('renders formatMessage as HTML when rawOutput is false', () => {
        const store = createStoreWithState({ rawOutput: false })
        const event = makeEvent({ formatMessage: '<strong>Bold</strong>' })
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        // With v-html the <strong> should render as an element
        const col = wrapper.find('.console-message')
        expect(col.html()).toContain('<strong>')
    })

    it('renders raw message as plain text when rawOutput is true', () => {
        const store = createStoreWithState({ rawOutput: true })
        const event = makeEvent({
            message: '<strong>Plain</strong>',
            formatMessage: '<strong>Bold</strong>',
        })
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        // rawOutput mode uses v-text, so tags should be escaped
        expect(wrapper.text()).toContain('<strong>Plain</strong>')
    })

    // ── Message class based on type ──
    it('applies text-disabled class for action type events', () => {
        const store = createStoreWithState()
        const event = makeEvent({ type: 'action', message: 'Processing...' })
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        const messageCol = wrapper.findAll('.console-message')
        expect(messageCol.length).toBeGreaterThan(0)
        // The message col should have text-disabled class
        expect(wrapper.html()).toContain('text-disabled')
    })

    it('applies text-disabled class for debug type events', () => {
        const store = createStoreWithState()
        const event = makeEvent({ type: 'debug', message: 'Debug info' })
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        expect(wrapper.html()).toContain('text-disabled')
    })

    it('applies text-error class for messages starting with "!! "', () => {
        const store = createStoreWithState()
        const event = makeEvent({ message: '!! Something went wrong' })
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        expect(wrapper.html()).toContain('text-error')
    })

    it('applies text-primary class for normal messages', () => {
        const store = createStoreWithState()
        const event = makeEvent({ type: 'message', message: 'Normal info' })
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        expect(wrapper.html()).toContain('text-primary')
    })

    // ── Command click event ──
    it('emits command-click when clicking a command anchor', async () => {
        const store = createStoreWithState()
        const event = makeEvent({
            formatMessage: '<a class="command">G28</a>',
        })
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        // Find the anchor with class "command"
        const link = wrapper.find('a.command')
        expect(link.exists()).toBe(true)

        await link.trigger('click')
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('command-click')).toBeTruthy()
        expect(wrapper.emitted('command-click')![0]).toEqual(['G28'])
    })

    it('does not emit command-click when clicking non-command elements', async () => {
        const store = createStoreWithState()
        const event = makeEvent({
            formatMessage: 'Just normal text',
        })
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        // Click on the message column itself (not an anchor)
        await wrapper.find('.console-message').trigger('click')
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('command-click')).toBeFalsy()
    })

    it('handles multiline commands with <br> tags', async () => {
        const store = createStoreWithState()
        const event = makeEvent({
            formatMessage: '<a class="command">line1<br>line2</a>',
        })
        const wrapper = mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        const link = wrapper.find('a.command')
        await link.trigger('click')
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('command-click')![0]).toEqual(['line1\nline2'])
    })

    it('calls formatTime with the event date timestamp', () => {
        const store = createStoreWithState()
        const timestamp = 1705312200000
        const event = makeEvent({ date: new Date(timestamp) })
        mount(ConsoleTableEntry, {
            props: { event },
            global: { plugins: [store] },
        })

        expect(mockFormatTime).toHaveBeenCalledWith(timestamp, true)
    })
})
