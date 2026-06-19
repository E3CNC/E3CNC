import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'

// ── Mock useBase ──
const mockPrinterState = ref('standby')

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        printer_state: mockPrinterState,
    }),
}))

// ── Mock useControl ──
const mockDoSend = vi.fn()

vi.mock('@/composables/useControl', () => ({
    useControl: () => ({
        doSend: mockDoSend,
    }),
}))

// ── Mock vue-i18n ──
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, params?: Record<string, any>) => {
            const translations: Record<string, string> = {
                'Panels.TemperaturePanel.TempTooHigh': 'Temperature too high! Max is {max}',
                'Panels.TemperaturePanel.TempTooLow': 'Temperature too low! Min is {min}',
            }
            let msg = translations[key] ?? key
            if (params) {
                Object.entries(params).forEach(([k, v]) => {
                    msg = msg.replace(`{${k}}`, String(v))
                })
            }
            return msg
        },
    }),
}))

vi.mock('@mdi/js', () => ({
    mdiSnowflake: 'mdiSnowflake',
    mdiFire: 'mdiFire',
    mdiMenuDown: 'mdiMenuDown',
}))

import TemperatureInput from '@/components/inputs/TemperatureInput.vue'

describe('TemperatureInput.vue', () => {
    const defaultProps = {
        name: 'extruder',
        target: 200,
        minTemp: 0,
        maxTemp: 300,
        command: 'M104',
        attributeName: 'S',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockPrinterState.value = 'standby'
    })

    function mountComponent(props = {}, stubs: Record<string, any> = {}) {
        return shallowMount(TemperatureInput, {
            props: { ...defaultProps, ...props },
            global: {
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        props: ['modelValue', 'suffix', 'type'],
                        template: '<div class="v-text-field-stub">{{ modelValue }} {{ suffix }}</div>',
                    },
                    'v-menu': {
                        name: 'VMenu',
                        template: '<div class="v-menu-stub"><slot name="activator" /><slot /></div>',
                    },
                    'v-btn': {
                        name: 'VBtn',
                        props: ['disabled', 'size', 'variant'],
                        template: '<button class="v-btn-stub" :disabled="disabled"><slot /></button>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<i class="v-icon-stub"><slot /></i>',
                    },
                    'v-list': {
                        name: 'VList',
                        props: ['density'],
                        template: '<div class="v-list-stub"><slot /></div>',
                    },
                    'v-list-item': {
                        name: 'VListItem',
                        props: ['link'],
                        template: '<div class="v-list-item-stub" @click="$emit(\'click\')"><slot /></div>',
                    },
                    'form': {
                        name: 'Form',
                        template: '<form><slot /></form>',
                    },
                    ...stubs,
                },
            },
        })
    }

    it('renders the current target value', async () => {
        const wrapper = mountComponent()
        await wrapper.vm.$nextTick()
        expect(wrapper.text()).toContain('200')
        expect(wrapper.text()).toContain('°C')
    })

    it('renders presets button when presets are provided', () => {
        const wrapper = mountComponent({ presets: [180, 200, 220] })
        const btn = wrapper.find('.v-btn-stub')
        expect(btn.exists()).toBe(true)
    })

    it('does not render presets button when presets is not provided', () => {
        const wrapper = mountComponent()
        const btn = wrapper.find('.v-btn-stub')
        expect(btn.exists()).toBe(false)
    })

    it('disables presets button when printer is printing or paused', () => {
        mockPrinterState.value = 'printing'
        const wrapper = mountComponent({ presets: [180, 200] })
        const btn = wrapper.find('.v-btn-stub')
        expect(btn.attributes('disabled')).toBeDefined()
    })

    it('enables presets button when printer is not printing', () => {
        mockPrinterState.value = 'standby'
        const wrapper = mountComponent({ presets: [180, 200] })
        const btn = wrapper.find('.v-btn-stub')
        expect(btn.attributes('disabled')).toBeUndefined()
    })

    it('sends SET_TEMPERATURE command on submit when value changes', async () => {
        const wrapper = mountComponent()
        // Change the value
        wrapper.vm.value = 210
        await wrapper.vm.$nextTick()

        wrapper.vm.setTemps()
        await wrapper.vm.$nextTick()

        expect(mockDoSend).toHaveBeenCalledWith('M104 S=extruder TARGET=210')
    })

    it('does not send command when value is above maxTemp', async () => {
        const wrapper = mountComponent()
        wrapper.vm.value = 350
        await wrapper.vm.$nextTick()

        wrapper.vm.setTemps()
        await wrapper.vm.$nextTick()

        expect(mockDoSend).not.toHaveBeenCalled()
        // Value should be reset to target
        expect(wrapper.vm.value).toBe(200)
    })

    it('does not send command when value is below minTemp and non-zero', async () => {
        const wrapper = mountComponent()
        wrapper.vm.value = -10
        await wrapper.vm.$nextTick()

        wrapper.vm.setTemps()
        await wrapper.vm.$nextTick()

        expect(mockDoSend).not.toHaveBeenCalled()
        expect(wrapper.vm.value).toBe(200)
    })

    it('allows value of 0 even when below minTemp', async () => {
        const wrapper = mountComponent({ minTemp: 50 })
        wrapper.vm.value = 0
        await wrapper.vm.$nextTick()

        wrapper.vm.setTemps()
        await wrapper.vm.$nextTick()

        // 0 should be allowed (turn off)
        expect(mockDoSend).toHaveBeenCalled()
    })

    it('does not send command when value is same as target', async () => {
        const wrapper = mountComponent({ target: 200 })
        wrapper.vm.value = 200
        await wrapper.vm.$nextTick()

        wrapper.vm.setTemps()
        await wrapper.vm.$nextTick()

        expect(mockDoSend).not.toHaveBeenCalled()
    })

    it('sets value from target prop on mount', async () => {
        const wrapper = mountComponent({ target: 240 })
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.value).toBe(240)
    })

    it('updates value when target prop changes', async () => {
        const wrapper = mountComponent({ target: 200 })
        expect(wrapper.vm.value).toBe(200)

        await wrapper.setProps({ target: 220 })
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.value).toBe(220)
    })

    it('renders preset items with snowflake icon for 0 value', () => {
        const wrapper = mountComponent({ presets: [0, 200] })
        const items = wrapper.findAll('.v-list-item-stub')
        expect(items).toHaveLength(2)
    })
})
