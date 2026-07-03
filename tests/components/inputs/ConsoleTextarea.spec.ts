// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'

// ── Mock useBase ──
const mockIsTouchDevice = ref(false)

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        isTouchDevice: mockIsTouchDevice,
    }),
}))

// ── Mock useConsole ──
const mockHelplist = ref<any[]>([])
const mockLastCommands = ref<string[]>([])

vi.mock('@/composables/useConsole', () => ({
    useConsole: () => ({
        helplist: mockHelplist,
        lastCommands: mockLastCommands,
    }),
}))

// ── Mock helpers ──
const mockStrLongestEqual = vi.hoisted(() =>
    vi.fn((a: string, b: string) => {
        let i = 0
        while (i < a.length && i < b.length && a[i] === b[i]) i++
        return a.substring(0, i)
    })
)

vi.mock('@/plugins/helpers', () => ({
    strLongestEqual: mockStrLongestEqual,
}))

vi.mock('@mdi/js', () => ({
    mdiSend: 'mdiSend',
    mdiChevronDoubleRight: 'mdiChevronDoubleRight',
}))

import ConsoleTextarea from '@/components/inputs/ConsoleTextarea.vue'

describe('ConsoleTextarea.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockHelplist.value = []
        mockLastCommands.value = []
        mockIsTouchDevice.value = false
    })

    function createStoreAndMount(storeState: Record<string, any> = {}): { wrapper: any; store: any } {
        const store = createStore({
            state: storeState,
        })

        const wrapper: any = shallowMount(ConsoleTextarea, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-textarea': {
                        name: 'VTextarea',
                        props: ['modelValue', 'label', 'rows', 'autocomplete'],
                        template: '<div class="v-textarea-stub">{{ label }}: {{ modelValue }}</div>',
                    },
                },
            },
        })

        return { wrapper, store }
    }

    it('renders with default empty gcode', () => {
        const { wrapper }: { wrapper: any } = createStoreAndMount()
        expect((wrapper.vm as any).gcode).toBe('')
        expect(wrapper.text()).toContain('Panels.MiniconsolePanel.SendCode')
    })

    it('dispatches sendGcode and addToHistory on doSend', () => {
        const { wrapper, store }: { wrapper: any; store: any } = createStoreAndMount()
        const dispatchSpy = (vi.spyOn(store, 'dispatch')(wrapper.vm as any).gcode = 'G28'(wrapper.vm as any).doSend({
            shiftKey: false,
        } as KeyboardEvent))

        expect(dispatchSpy).toHaveBeenCalledWith('printer/sendGcode', 'G28')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/gcodehistory/addToHistory', 'G28')
        expect((wrapper.vm as any).gcode).toBe('')
        expect((wrapper.vm as any).lastCommandNumber).toBeNull()
    })

    it('does not send empty gcode', () => {
        const { wrapper, store }: { wrapper: any; store: any } = createStoreAndMount()
        const dispatchSpy = (vi.spyOn(store, 'dispatch')(wrapper.vm as any).gcode = ''(wrapper.vm as any).doSend({
            shiftKey: false,
        } as KeyboardEvent))

        expect(dispatchSpy).not.toHaveBeenCalled()
    })

    it('adds newline on Shift+Enter', () => {
        const { wrapper }: { wrapper: any } = (createStoreAndMount()(wrapper.vm as any).gcode = 'G28'(
            wrapper.vm as any
        ).doSend({ shiftKey: true } as KeyboardEvent))

        expect((wrapper.vm as any).gcode).toBe('G28\n')
    })

    it('navigates through last commands with arrow up', () => {
        mockLastCommands.value = ['G28', 'M106', 'G90']
        const { wrapper }: { wrapper: any } = createStoreAndMount()(
            // First press: go to last command
            wrapper.vm as any
        ).onKeyUp({ preventDefault: vi.fn() } as any)
        expect((wrapper.vm as any).gcode).toBe('G90')
        expect((wrapper.vm as any).lastCommandNumber)
            .toBe(2)
            (
                // Second press: go to previous
                wrapper.vm as any
            )
            .onKeyUp({ preventDefault: vi.fn() } as any)
        expect((wrapper.vm as any).gcode).toBe('M106')
        expect((wrapper.vm as any).lastCommandNumber).toBe(1)
    })

    it('cycles forward with arrow down', () => {
        mockLastCommands.value = ['G28', 'M106']
        const { wrapper }: { wrapper: any } = createStoreAndMount()(
            // Start with empty, press up to go to last command
            wrapper.vm as any
        ).onKeyUp({ preventDefault: vi.fn() } as any)
        expect((wrapper.vm as any).gcode)
            .toBe('M106')
            (
                // position 1

                // Arrow down from position 1 (last): goes to empty
                wrapper.vm as any
            )
            .onKeyDown({ preventDefault: vi.fn() } as any)
        expect((wrapper.vm as any).gcode).toBe('')
        expect((wrapper.vm as any).lastCommandNumber).toBeNull()
    })

    it('navigates forward with arrow down from middle position', () => {
        mockLastCommands.value = ['G28', 'M106', 'G90']
        const { wrapper }: { wrapper: any } = createStoreAndMount()(
            // Go to middle command (M106 at position 1)
            wrapper.vm as any
        ).onKeyUp({ preventDefault: vi.fn() } as any)
        expect((wrapper.vm as any).gcode)
            .toBe('G90')(
                // position 2
                wrapper.vm as any
            )
            .onKeyUp({ preventDefault: vi.fn() } as any)
        expect((wrapper.vm as any).gcode)
            .toBe('M106')
            (
                // position 1

                // Arrow down from position 1: goes to position 2 (G90)
                wrapper.vm as any
            )
            .onKeyDown({ preventDefault: vi.fn() } as any)
        expect((wrapper.vm as any).gcode).toBe('G90')
        expect((wrapper.vm as any).lastCommandNumber).toBe(2)
    })

    it('does nothing on arrow down when lastCommandNumber is null', () => {
        const { wrapper }: { wrapper: any } = createStoreAndMount()(wrapper.vm as any).onKeyDown({
            preventDefault: vi.fn(),
        } as any)
        expect((wrapper.vm as any).gcode).toBe('')
    })

    it('does nothing on arrow up when no last commands', () => {
        const { wrapper }: { wrapper: any } = createStoreAndMount()(wrapper.vm as any).onKeyUp({
            preventDefault: vi.fn(),
        } as any)
        expect((wrapper.vm as any).gcode).toBe('')
    })

    it('empties gcode on doSend and resets lastCommandNumber', () => {
        mockLastCommands.value = ['G28']
        const { wrapper, store }: { wrapper: any; store: any } = createStoreAndMount()
        const dispatchSpy = (vi.spyOn(store, 'dispatch')(wrapper.vm as any).gcode = 'M106'(wrapper.vm as any).doSend({
            shiftKey: false,
        } as KeyboardEvent))

        expect(dispatchSpy).toHaveBeenCalled()
        expect((wrapper.vm as any).gcode).toBe('')
        expect((wrapper.vm as any).lastCommandNumber).toBeNull()
    })

    it('does autocomplete() with empty helplist does nothing', () => {
        mockHelplist.value = []
        const { wrapper }: { wrapper: any } =
            (createStoreAndMount()(
                // Set up mock textarea ref needed for autocomplete
                wrapper.vm as any
            ).gcodeCommandField =
            {
                $refs: { input: { selectionStart: 1, value: 'G' } },
            }(wrapper.vm as any).gcode =
                'G'(wrapper.vm as any).onAutocomplete({ preventDefault: vi.fn() } as any))

        // No matching commands, gcode unchanged
        expect((wrapper.vm as any).gcode).toBe('G')
    })

    it('does autocomplete() with single matching command updates gcode', () => {
        mockHelplist.value = [{ command: 'G28', help: 'Home all axes' }]

        const { wrapper }: { wrapper: any } =
            (createStoreAndMount()(wrapper.vm as any).gcode =
            'G2'(
                // Set up mock textarea ref
                wrapper.vm as any
            ).gcodeCommandField =
                {
                    $refs: { input: { selectionStart: 2, value: 'G2' } },
                }(wrapper.vm as any).onAutocomplete({ preventDefault: vi.fn() } as any))

        // Should update gcode with the matched command
        expect((wrapper.vm as any).gcode).toBe('G28')
    })

    it('does not autocomplete when gcode is empty', () => {
        const { wrapper }: { wrapper: any } = createStoreAndMount()
        const preventDefault = vi
            .fn()(wrapper.vm as any)
            .onAutocomplete({ preventDefault } as any)

        expect(preventDefault).toHaveBeenCalled()
        expect((wrapper.vm as any).gcode).toBe('')
    })
})
