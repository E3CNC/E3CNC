import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorPicker from '@/components/inputs/ColorPicker.vue'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({}),
}))

vi.mock('@jaames/iro', () => ({
    default: {
        ColorPicker: vi.fn(() => ({
            on: vi.fn(),
            off: vi.fn(),
            color: { rgbString: '#ffffff' },
        })),
        ui: {
            Wheel: {},
            Slider: {},
        },
    },
}))

describe('ColorPicker.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders a div container', () => {
        const wrapper = mount(ColorPicker)
        expect(wrapper.find('div').exists()).toBe(true)
    })

    it('renders with default color', () => {
        const wrapper = mount(ColorPicker, {
            props: { color: '#ff0000' },
        })
        expect(wrapper.find('div').exists()).toBe(true)
    })

    it('renders without crashing when no props provided', () => {
        const wrapper = mount(ColorPicker)
        expect(wrapper.exists()).toBe(true)
    })
})
