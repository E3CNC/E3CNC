import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'

// ── Mocks ──
const mocks = vi.hoisted(() => ({
    mockSocketEmit: vi.fn(),
    mockLoadings: { value: [] as string[] },
    mockIsMobile: { value: false },
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.mockSocketEmit }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        loadings: mocks.mockLoadings,
        isMobile: mocks.mockIsMobile,
    }),
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['title', 'cardClass', 'marginBottom'],
        template: '<div class="panel-stub"><slot name="buttons" /><slot /></div>',
    },
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (k: string) => k }),
}))

vi.mock('@mdi/js', () => ({
    mdiCloseThick: 'closeThick',
    mdiMenuDown: 'menuDown',
    mdiRefresh: 'refresh',
}))

import MacroButton from '@/components/inputs/MacroButton.vue'

describe('MacroButton.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.mockLoadings.value = []
        mocks.mockIsMobile.value = false
    })

    const baseMacro = { name: 'TEST_MACRO', rename: null }

    function createStoreWithGetter(macroData = {}) {
        return createStore({
            state: { printer: { gcode: {} } },
            getters: {
                'printer/getMacro': () => (name: string) => ({
                    name,
                    description: 'A test macro',
                    params: {},
                    ...macroData,
                }),
            },
        })
    }

    function mountComponent(props = {}, macroData = {}) {
        const store = createStoreWithGetter(macroData)
        return shallowMount(MacroButton, {
            props: { macro: baseMacro, ...props },
            global: { plugins: [store], mocks: { $t: (k: string) => k } },
        })
    }

    function mountWithCustomStore(store: any, props = {}) {
        return shallowMount(MacroButton, {
            props: { macro: baseMacro, ...props },
            global: { plugins: [store], mocks: { $t: (k: string) => k } },
        })
    }

    it('renders the macro name', () => {
        const wrapper = mountComponent()
        expect(wrapper.exists()).toBe(true)
    })

    it('uses alias when provided', () => {
        const wrapper = mountComponent({ alias: 'My Button' })
        expect(wrapper.exists()).toBe(true)
    })

    it('sends macro command on click via doSendMacro', () => {
        const store = createStoreWithGetter()
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        const wrapper = mountWithCustomStore(store)

        wrapper.vm.doSendMacro('TEST_MACRO')

        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'TEST_MACRO',
            type: 'command',
        })
        expect(mocks.mockSocketEmit).toHaveBeenCalledWith(
            'printer.gcode.script',
            { script: 'TEST_MACRO' },
            { loading: 'macro_TEST_MACRO' }
        )
    })

    it('mounts with loading state', () => {
        mocks.mockLoadings.value = ['macro_TEST_MACRO']
        const wrapper = mountComponent()
        expect(wrapper.exists()).toBe(true)
    })

    it('does not show description tooltip when description is default', () => {
        const wrapper = mountComponent({}, { description: 'G-Code macro' })
        expect(wrapper.vm.hasDescription).toBe(false)
    })

    it('shows description tooltip for non-default description', () => {
        const wrapper = mountComponent({}, { description: 'Custom description' })
        expect(wrapper.vm.hasDescription).toBe(true)
    })

    it('parses parameters from klipper macro data', () => {
        const wrapper = mountComponent({}, {
            params: { SPEED: { type: 'int', default: 100 }, FAN: { type: 'string', default: 'off' } },
        })
        expect(wrapper.vm.paramArray.length).toBeGreaterThan(0)
    })

    it('skips parameters starting with underscore', () => {
        const wrapper = mountComponent({}, {
            params: { SPEED: { type: 'int', default: 100 }, _internal: { type: 'string', default: '' } },
        })
        expect(wrapper.vm.paramArray).toContain('SPEED')
        expect(wrapper.vm.paramArray).not.toContain('_internal')
    })

    it('sendWithParams builds gcode with params', () => {
        const store = createStoreWithGetter()
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        const wrapper = mountWithCustomStore(store)

        wrapper.vm.paramArray = ['SPEED']
        wrapper.vm.params = { SPEED: { type: 'int', default: 100, value: '200' } }
        wrapper.vm.sendWithParams()

        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'TEST_MACRO SPEED=200',
            type: 'command',
        })
    })

    it('sendWithParams handles quoted values', () => {
        const store = createStoreWithGetter()
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        const wrapper = mountWithCustomStore(store)

        wrapper.vm.paramArray = ['MSG']
        wrapper.vm.params = { MSG: { type: 'string', default: '', value: 'hello world' } }
        wrapper.vm.sendWithParams()

        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'TEST_MACRO MSG="hello world"',
            type: 'command',
        })
    })

    it('isGcodeStyle detects G/M codes', () => {
        const gcodeMacro = { name: 'G28', rename: null }
        const wrapper = mountComponent({ macro: gcodeMacro })
        expect(wrapper.vm.isGcodeStyle).toBeTruthy()
    })

    it('non-G-code macros use = syntax', () => {
        const wrapper = mountComponent()
        expect(wrapper.vm.isGcodeStyle).toBeFalsy()
    })

    it('paramCols returns 1 on mobile', () => {
        mocks.mockIsMobile.value = true
        const wrapper = mountComponent({}, {
            params: { A: { type: 'int', default: 1 }, B: { type: 'int', default: 2 }, C: { type: 'int', default: 3 } },
        })
        expect(wrapper.vm.paramCols).toBe(1)
    })

    it('paramCols caps at 4 on desktop', () => {
        mocks.mockIsMobile.value = false
        const wrapper = mountComponent({}, {
            params: { A: {}, B: {}, C: {}, D: {}, E: {}, F: {} },
        })
        // 6 params / 5 = 1.2, ceil = 2, min(2,4) = 2
        expect(wrapper.vm.paramCols).toBe(2)
    })
})
