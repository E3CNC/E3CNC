import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'
import ConsoleTable from '@/components/console/ConsoleTable.vue'
import type { ServerStateEvent } from '@/store/server/types'

// ── Create a minimal store ──
function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            gui: {
                console: {
                    entryStyle: 'default',
                    rawOutput: false,
                },
                ...(overrides.gui || {}),
            } as any,
        },
    })
}

function mountOptions(store: ReturnType<typeof createStore>) {
    return {
        global: {
            plugins: [store],
            mocks: { $t: (key: string) => key },
            stubs: {
                'v-row': { name: 'VRow', template: '<div class="v-row-stub"><slot /></div>' },
                'v-col': { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
            },
        },
    }
}

describe('ConsoleTable.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders empty state when events array is empty', () => {
        const store = createStoreWithState()
        const wrapper = shallowMount(ConsoleTable, {
            props: { events: [] },
            ...mountOptions(store),
        })

        expect(wrapper.text()).toContain('Console.Empty')
    })

    it('renders entries when events are provided', () => {
        const store = createStoreWithState()
        const events: ServerStateEvent[] = [
            { date: new Date('2024-01-15T10:30:00'), type: 'message', message: 'Hello', formatMessage: 'Hello' },
            { date: new Date('2024-01-15T10:31:00'), type: 'command', message: 'G28', formatMessage: '<a class="command">G28</a>' },
        ]
        const wrapper = shallowMount(ConsoleTable, {
            props: { events },
            ...mountOptions(store),
        })

        // Should NOT show empty text
        expect(wrapper.text()).not.toContain('Console.Empty')

        // Should render a console-table-entry for each event (stub)
        const entries = wrapper.findAllComponents({ name: 'ConsoleTableEntry' })
        expect(entries).toHaveLength(2)
    })

    it('forwards command-click emit from child entries', async () => {
        const store = createStoreWithState()
        const events: ServerStateEvent[] = [
            { date: new Date('2024-01-15T10:30:00'), type: 'message', message: 'Test', formatMessage: 'Test' },
        ]
        const wrapper = shallowMount(ConsoleTable, {
            props: { events },
            ...mountOptions(store),
        })

        // Simulate the child entry emitting command-click
        const entry = wrapper.findComponent({ name: 'ConsoleTableEntry' })
        entry.vm.$emit('command-click', 'G28')

        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('command-click')).toBeTruthy()
        expect(wrapper.emitted('command-click')![0]).toEqual(['G28'])
    })

    it('applies mini class when isMini is true', () => {
        const store = createStoreWithState()
        const wrapper = shallowMount(ConsoleTable, {
            props: { events: [], isMini: true },
            ...mountOptions(store),
        })

        expect(wrapper.classes()).toContain('mini')
    })

    it('does not apply mini class when isMini is false', () => {
        const store = createStoreWithState()
        const wrapper = shallowMount(ConsoleTable, {
            props: { events: [] },
            ...mountOptions(store),
        })

        expect(wrapper.classes()).not.toContain('mini')
    })

    it('renders consoleTableRow class on each entry', () => {
        const store = createStoreWithState()
        const events: ServerStateEvent[] = [
            { date: new Date('2024-01-15T10:30:00'), type: 'message', message: 'Test', formatMessage: 'Test' },
        ]
        const wrapper = shallowMount(ConsoleTable, {
            props: { events },
            ...mountOptions(store),
        })

        const entries = wrapper.findAll('.consoleTableRow')
        expect(entries).toHaveLength(1)
    })
})
