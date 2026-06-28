import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import MiscellaneousLightNeopixelState from '@/components/panels/Miscellaneous/MiscellaneousLightNeopixelState.vue'

// ── Mock store ──
function createStoreWithPrinter(printerOverrides: Record<string, any> = {}) {
    return createStore({
        state: {
            printer: {
                'led neopixel': {
                    color_data: [[1, 0.5, 0, 0]],
                },
                ...printerOverrides,
            },
        },
    })
}

function makeStoreWithCustomPrinter(customPrinter: Record<string, any>) {
    return createStore({
        state: {
            printer: customPrinter,
        },
    })
}

describe('MiscellaneousLightNeopixelState.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders a color dot span', () => {
        const store = createStoreWithPrinter()
        const wrapper = mount(MiscellaneousLightNeopixelState, {
            props: { type: 'led', name: 'neopixel', index: 1 },
            global: { plugins: [store] },
        })
        const span = wrapper.find('span')
        expect(span.exists()).toBe(true)
    })

    it('sets background-color from color_data', () => {
        const store = createStoreWithPrinter()
        const wrapper = mount(MiscellaneousLightNeopixelState, {
            props: { type: 'led', name: 'neopixel', index: 1 },
            global: { plugins: [store] },
        })
        const span = wrapper.find('span')
        // red=1, green=0.5, blue=0 → rgba(255, 128, 0)
        expect(span.attributes('style')).toContain('255, 128, 0')
    })

    it('uses white channel when RGB are all zero and white > 0', () => {
        const store = makeStoreWithCustomPrinter({
            'led neopixel': {
                color_data: [[0, 0, 0, 0.5]],
            },
        })
        const wrapper = mount(MiscellaneousLightNeopixelState, {
            props: { type: 'led', name: 'neopixel', index: 1 },
            global: { plugins: [store] },
        })
        const span = wrapper.find('span')
        // white=0.5 → rgb(128, 128, 128)
        expect(span.attributes('style')).toContain('background-color: rgb(128, 128, 128)')
    })

    it('handles null color_data gracefully', () => {
        const store = makeStoreWithCustomPrinter({
            'led neopixel': {},
        })
        const wrapper = mount(MiscellaneousLightNeopixelState, {
            props: { type: 'led', name: 'neopixel', index: 1 },
            global: { plugins: [store] },
        })
        const span = wrapper.find('span')
        // All nulls → rgba(0, 0, 0)
        expect(span.attributes('style')).toContain('0, 0, 0')
    })

    it('accesses correct index in color_data (index=2)', () => {
        const store = makeStoreWithCustomPrinter({
            'led neopixel': {
                color_data: [
                    [0, 0, 0, 0],
                    [1, 0, 0.5, 0],
                ],
            },
        })
        const wrapper = mount(MiscellaneousLightNeopixelState, {
            props: { type: 'led', name: 'neopixel', index: 2 },
            global: { plugins: [store] },
        })
        const span = wrapper.find('span')
        // index=2 → second array: red=1, green=0, blue=0.5 → rgba(255, 0, 128)
        expect(span.attributes('style')).toContain('255, 0, 128')
    })

    it('emits click-button on click', async () => {
        const store = createStoreWithPrinter()
        const wrapper = mount(MiscellaneousLightNeopixelState, {
            props: { type: 'led', name: 'neopixel', index: 1 },
            global: { plugins: [store] },
        })
        const span = wrapper.find('span')
        await span.trigger('click')
        expect(wrapper.emitted('click-button')).toBeTruthy()
    })
})
