import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'

// ── Mock useBase ──
const mockPrinterIsPrintingOnly = ref(false)
const mockLoadings = ref<string[]>([])
const mockSocketEmit = vi.fn()

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        printerIsPrintingOnly: mockPrinterIsPrintingOnly,
        loadings: mockLoadings,
    }),
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: mockSocketEmit,
    }),
}))

// ── Mock @mdi/js (not used directly in template but imported) ──
// LedEffectButton only uses template text, no mdi icons in template

import LedEffectButton from '@/components/inputs/LedEffectButton.vue'

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            printer: {
                ...(overrides.printer || {}),
            },
            ...overrides,
        },
        getters: {},
    })
}

describe('LedEffectButton.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrinterIsPrintingOnly.value = false
        mockLoadings.value = []
    })

    it('renders the button with the effect name', () => {
        const store = createStoreWithState()
        const wrapper = shallowMount(LedEffectButton, {
            props: { name: 'MyEffect' },
            global: {
                plugins: [store],
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        props: ['color', 'loading', 'disabled', 'size'],
                        template:
                            '<button class="v-btn-stub" :class="color" :disabled="disabled"><slot /></button>',
                    },
                },
            },
        })

        expect(wrapper.text()).toContain('MyEffect')
    })

    it('shows button as success color when effect is enabled', () => {
        const store = createStoreWithState({
            printer: {
                'led_effect MyEffect': { enabled: true },
            },
        })
        const wrapper = shallowMount(LedEffectButton, {
            props: { name: 'MyEffect' },
            global: {
                plugins: [store],
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        props: ['color', 'loading', 'disabled'],
                        template:
                            '<button class="v-btn-stub" :class="color" :disabled="disabled"><slot /></button>',
                    },
                },
            },
        })

        const btn = wrapper.find('.v-btn-stub')
        expect(btn.classes()).toContain('success')
    })

    it('shows button as primary color when effect is disabled', () => {
        const store = createStoreWithState({
            printer: {
                'led_effect MyEffect': { enabled: false },
            },
        })
        const wrapper = shallowMount(LedEffectButton, {
            props: { name: 'MyEffect' },
            global: {
                plugins: [store],
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        props: ['color', 'loading', 'disabled'],
                        template:
                            '<button class="v-btn-stub" :class="color" :disabled="disabled"><slot /></button>',
                    },
                },
            },
        })

        const btn = wrapper.find('.v-btn-stub')
        expect(btn.classes()).toContain('primary')
    })

    it('disables button when printerIsPrintingOnly is true', () => {
        mockPrinterIsPrintingOnly.value = true

        const store = createStoreWithState()
        const wrapper = shallowMount(LedEffectButton, {
            props: { name: 'TestEffect' },
            global: {
                plugins: [store],
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        props: ['disabled'],
                        template:
                            '<button class="v-btn-stub" :disabled="disabled"><slot /></button>',
                    },
                },
            },
        })

        const btn = wrapper.find('.v-btn-stub')
        expect(btn.attributes('disabled')).toBeDefined()
    })

    it('shows loading state when loading key is present', () => {
        mockLoadings.value = ['led_effect_TestEffect']

        const store = createStoreWithState()
        const wrapper = shallowMount(LedEffectButton, {
            props: { name: 'TestEffect' },
            global: {
                plugins: [store],
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        props: ['loading', 'disabled'],
                        template:
                            '<button class="v-btn-stub" :loading="loading"><slot /></button>',
                    },
                },
            },
        })

        const btn = wrapper.find('.v-btn-stub')
        expect(btn.attributes('loading')).toBeDefined()
    })

    it('toggles effect on click — sends start command when disabled', async () => {
        const store = createStoreWithState({
            printer: {
                'led_effect MyEffect': { enabled: false },
            },
        })
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        const wrapper = shallowMount(LedEffectButton, {
            props: { name: 'MyEffect' },
            global: {
                plugins: [store],
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        template: '<button class="v-btn-stub" @click="$emit(\'click\')"><slot /></button>',
                    },
                },
            },
        })

        await wrapper.find('.v-btn-stub').trigger('click')
        await wrapper.vm.$nextTick()

        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'SET_LED_EFFECT EFFECT="MyEffect"',
            type: 'command',
        })
        expect(mockSocketEmit).toHaveBeenCalledWith(
            'printer.gcode.script',
            { script: 'SET_LED_EFFECT EFFECT="MyEffect"' },
            { loading: 'led_effect_MyEffect' }
        )
    })

    it('toggles effect on click — sends stop command when enabled', async () => {
        const store = createStoreWithState({
            printer: {
                'led_effect MyEffect': { enabled: true },
            },
        })
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        const wrapper = shallowMount(LedEffectButton, {
            props: { name: 'MyEffect' },
            global: {
                plugins: [store],
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        template: '<button class="v-btn-stub" @click="$emit(\'click\')"><slot /></button>',
                    },
                },
            },
        })

        await wrapper.find('.v-btn-stub').trigger('click')
        await wrapper.vm.$nextTick()

        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'SET_LED_EFFECT EFFECT="MyEffect" STOP=1',
            type: 'command',
        })
        expect(mockSocketEmit).toHaveBeenCalledWith(
            'printer.gcode.script',
            { script: 'SET_LED_EFFECT EFFECT="MyEffect" STOP=1' },
            { loading: 'led_effect_MyEffect' }
        )
    })

    it('handles missing printer state gracefully', () => {
        const store = createStoreWithState({
            printer: {}, // no 'led_effect MyEffect' key
        })
        const wrapper = shallowMount(LedEffectButton, {
            props: { name: 'NonExistent' },
            global: {
                plugins: [store],
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        props: ['color'],
                        template: '<button class="v-btn-stub" :class="color"><slot /></button>',
                    },
                },
            },
        })

        // Should default to primary when effect state is unknown
        const btn = wrapper.find('.v-btn-stub')
        expect(btn.classes()).toContain('primary')
    })
})
