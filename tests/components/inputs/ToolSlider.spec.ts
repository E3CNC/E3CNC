import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'

// ── Mocks ──
const mockSocketEmit = vi.fn()
const mockIsTouchDevice = ref(false)

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mockSocketEmit }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ isTouchDevice: mockIsTouchDevice }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, params?: Record<string, any>) => {
            const m: Record<string, string> = {
                'App.NumberInput.NoEmptyAllowedError': 'Cannot be empty',
                'App.NumberInput.GreaterOrEqualError': 'Must be ≥ {min}',
                'App.NumberInput.MustBeBetweenError': 'Must be between {min} and {max}',
            }
            let msg = m[key] ?? key
            if (params) Object.entries(params).forEach(([k, v]) => (msg = msg.replace(`{${k}}`, String(v))))
            return msg
        },
    }),
}))

vi.mock('@mdi/js', () => ({
    mdiLockOpenVariantOutline: 'lockOpen',
    mdiLockOutline: 'lockClosed',
    mdiMinus: 'minus',
    mdiPlus: 'plus',
    mdiRestart: 'restart',
}))

import ToolSlider from '@/components/inputs/ToolSlider.vue'

const baseProps = {
    target: 100,
    command: 'G1',
    attributeName: 'F',
    label: 'Speed',
    unit: 'mm/min',
    min: 0,
    max: 500,
}

// Shared stubs for all tests
const vuetifyStubs = {
    'v-row': { template: '<div><slot /></div>' },
    'v-col': { template: '<div><slot /></div>' },
    'v-list-subheader': { template: '<div><slot /></div>' },
    'v-icon': { template: '<i><slot /></i>' },
    'v-btn': {
        props: ['disabled', 'size', 'icon', 'variant'],
        template: '<button :disabled="disabled"><slot /></button>',
    },
    'v-spacer': { template: '<span />' },
    'v-text-field': {
        props: ['modelValue', 'error', 'suffix'],
        template: '<input :value="modelValue" class="v-text-field-stub" />',
    },
    'v-card-text': { template: '<div><slot /></div>' },
    'v-slider': {
        props: ['modelValue', 'disabled', 'min', 'max', 'color'],
        template: '<div class="v-slider-stub"></div>',
    },
}

describe('ToolSlider.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsTouchDevice.value = false
    })

    function mountComponent(props = {}, storeState: Record<string, any> = {}) {
        const store = createStore({
            state: {
                gui: { uiSettings: { lockSlidersOnTouchDevices: false, lockSlidersDelay: 0 }, ...storeState.gui },
                ...storeState,
            },
        })
        return shallowMount(ToolSlider, {
            props: { ...baseProps, ...props },
            global: { plugins: [store], mocks: { $t: (k: string) => k }, stubs: vuetifyStubs },
        })
    }

    it('renders label', () => {
        const wrapper = mountComponent({ icon: 'mdi-speedometer' })
        expect(wrapper.text()).toContain('Speed')
    })

    it('renders value with unit', () => {
        const wrapper = mountComponent()
        expect(wrapper.text()).toContain('100')
        expect(wrapper.text()).toContain('mm/min')
    })

    it('tracks target prop in _value', async () => {
        const wrapper = mountComponent({ target: 200 })
        expect(wrapper.vm._value).toBe(200)
        await wrapper.setProps({ target: 300 })
        expect(wrapper.vm._value).toBe(300)
    })

    it('applies multi scale to target', () => {
        const wrapper = mountComponent({ target: 50, multi: 2 })
        expect(wrapper.vm._value).toBe(100)
    })

    it('sendCmd dispatches and emits', () => {
        const store = createStore({ state: { gui: { uiSettings: {} } } })
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = shallowMount(ToolSlider, {
            props: baseProps,
            global: { plugins: [store], mocks: { $t: (k: string) => k }, stubs: vuetifyStubs },
        })
        wrapper.vm._value = 150
        wrapper.vm.sendCmd()
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', { message: 'G1 F150', type: 'command' })
        expect(mockSocketEmit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G1 F150' })
    })

    it('sendCmd uses attributeScale', () => {
        const store = createStore({ state: { gui: { uiSettings: {} } } })
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = shallowMount(ToolSlider, {
            props: { ...baseProps, attributeName: 'F', attributeScale: 60 },
            global: { plugins: [store], mocks: { $t: (k: string) => k }, stubs: vuetifyStubs },
        })
        wrapper.vm._value = 2
        wrapper.vm.sendCmd()
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', { message: 'G1 F120', type: 'command' })
    })

    it('increment increases _value', () => {
        const wrapper = mountComponent()
        wrapper.vm._value = 100
        wrapper.vm.increment()
        expect(wrapper.vm._value).toBe(101)
    })

    it('decrement decreases _value', () => {
        const wrapper = mountComponent()
        wrapper.vm._value = 100
        wrapper.vm.decrement()
        expect(wrapper.vm._value).toBe(99)
    })

    it('increment clamps at processedMax when not dynamic', () => {
        const wrapper = mountComponent({ max: 100 })
        wrapper.vm._value = 100
        wrapper.vm.increment()
        expect(wrapper.vm._value).toBe(100)
    })

    it('decrement clamps at min', () => {
        const wrapper = mountComponent({ min: 0 })
        wrapper.vm._value = 0
        wrapper.vm.decrement()
        expect(wrapper.vm._value).toBe(0)
    })

    it('resetSlider resets to defaultValue', () => {
        const wrapper = mountComponent({ defaultValue: 50, max: 100 })
        wrapper.vm._value = 200
        wrapper.vm.resetSlider()
        expect(wrapper.vm._value).toBe(50)
    })

    it('colorBar is warning when _value exceeds max', () => {
        const wrapper = mountComponent({ max: 100 })
        wrapper.vm._value = 150
        expect(wrapper.vm.colorBar).toBe('warning')
    })

    it('colorBar is primary when _value within max', () => {
        const wrapper = mountComponent({ max: 100 })
        wrapper.vm._value = 50
        expect(wrapper.vm.colorBar).toBe('primary')
    })

    it('hasInputField renders input field', () => {
        const wrapper = mountComponent({ hasInputField: true })
        expect(wrapper.find('.v-text-field-stub').exists()).toBe(true)
    })

    it('submitInput with valid value sends cmd', () => {
        const store = createStore({ state: { gui: { uiSettings: {} } } })
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = shallowMount(ToolSlider, {
            props: { ...baseProps, hasInputField: true },
            global: { plugins: [store], mocks: { $t: (k: string) => k }, stubs: vuetifyStubs },
        })
        wrapper.vm.numInput = 200
        wrapper.vm.submitInput()
        expect(dispatchSpy).toHaveBeenCalled()
    })

    it('submitInput with error does not send cmd', () => {
        const store = createStore({ state: { gui: { uiSettings: {} } } })
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = shallowMount(ToolSlider, {
            props: { ...baseProps, hasInputField: true, min: 0 },
            global: { plugins: [store], mocks: { $t: (k: string) => k }, stubs: vuetifyStubs },
        })
        wrapper.vm.numInput = -5
        wrapper.vm.submitInput()
        expect(dispatchSpy).not.toHaveBeenCalled()
    })

    it('lock button locks when lockSliders and isTouchDevice', () => {
        mockIsTouchDevice.value = true
        const wrapper = mountComponent({}, { gui: { uiSettings: { lockSlidersOnTouchDevices: true } } })
        expect(wrapper.vm.isLocked).toBe(true)
    })

    it('checkInvalidChars blocks e/E/+', () => {
        const wrapper = mountComponent()
        const e = new KeyboardEvent('keydown', { key: 'e' })
        const spy = vi.spyOn(e, 'preventDefault')
        wrapper.vm.checkInvalidChars(e)
        expect(spy).toHaveBeenCalled()
    })
})
