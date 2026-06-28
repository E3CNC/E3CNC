import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import MiscellaneousLightNeopixelDialog from '@/components/dialogs/MiscellaneousLightNeopixelDialog.vue'

vi.mock('@/plugins/helpers', () => ({
    caseInsensitiveSort: (arr: any[], key: string) => [...arr].sort((a: any, b: any) => a[key]?.localeCompare(b[key])),
    convertName: (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
}))

vi.mock('@jaames/iro', () => ({
    default: {
        ColorPicker: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), color: { rgbString: '#ffffff' } })),
        ui: { Wheel: {}, Slider: {} },
    },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], cardClass: String, marginBottom: Boolean },
        template:
            '<div class="panel" :class="cardClass"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'width'],
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'rounded'],
        template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>',
    },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VIcon: { name: 'VIcon', props: ['icon'], template: '<i class="v-icon"><slot /></i>' },
}))

vi.mock('@/components/inputs/ColorPicker.vue', () => ({
    default: {
        name: 'ColorPicker',
        props: ['color', 'options'],
        template: '<div class="color-picker-stub">{{ color }}</div>',
        emits: ['update:color'],
    },
}))

vi.mock('@/components/inputs/NumberInput.vue', () => ({
    default: {
        name: 'NumberInput',
        props: [
            'label',
            'param',
            'target',
            'defaultValue',
            'min',
            'max',
            'dec',
            'step',
            'hasSpinner',
            'outputErrorMsg',
        ],
        template: '<div class="number-input-stub">{{ param }}: {{ target }}</div>',
        emits: ['submit'],
    },
}))

vi.mock('@/components/dialogs/MiscellaneousLightNeopixelDialogPreset.vue', () => ({
    default: {
        name: 'MiscellaneousLightNeopixelDialogPreset',
        props: ['preset'],
        template: '<div class="preset-stub">{{ preset.name }}</div>',
        emits: ['update-color'],
    },
}))

describe('MiscellaneousLightNeopixelDialog.vue', () => {
    let store: ReturnType<typeof createStore>

    const baseStore = () =>
        createStore({
            state: {
                printer: {
                    configfile: {
                        settings: {
                            'neopixel my_strip': {
                                color_order: ['GRB'],
                                initial_red: 1.0,
                                initial_green: 0.5,
                                initial_blue: 0.0,
                                initial_white: 0.0,
                                chip: 'WS2812',
                            },
                        },
                    },
                    'neopixel my_strip': {
                        color_data: [[1.0, 0.5, 0.0, 0.0]],
                    },
                },
                gui: {
                    miscellaneous: {
                        entries: {},
                    },
                },
            },
        })

    beforeEach(() => {
        vi.clearAllMocks()
        store = baseStore()
    })

    it('does not render dialog when modelValue is false', () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: false, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders dialog when modelValue is true', () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('renders panel with converted name as title', () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        // convertName('my_strip') -> 'My Strip'
        expect(wrapper.find('.panel-title').text()).toBe('My Strip')
    })

    it('renders close button', () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-btn').exists()).toBe(true)
    })

    it('emits update:modelValue on close', async () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        await wrapper.find('.v-btn').trigger('click')
        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('renders ColorPicker components', () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const pickers = wrapper.findAllComponents({ name: 'ColorPicker' })
        expect(pickers.length).toBeGreaterThanOrEqual(1)
    })

    it('renders NumberInput for each color channel', () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        // color_order is GRB, so Green, Red, Blue inputs should render
        const inputs = wrapper.findAllComponents({ name: 'NumberInput' })
        expect(inputs.length).toBeGreaterThanOrEqual(3)
    })

    it('renders presets when gui entries have presets', () => {
        store = createStore({
            state: {
                printer: {
                    configfile: {
                        settings: {
                            'neopixel my_strip': {
                                color_order: ['GRB'],
                                initial_red: 0,
                                initial_green: 0,
                                initial_blue: 0,
                            },
                        },
                    },
                    'neopixel my_strip': { color_data: [[0, 0, 0, 0]] },
                },
                gui: {
                    miscellaneous: {
                        entries: {
                            preset1: {
                                type: 'neopixel',
                                name: 'my_strip',
                                presets: {
                                    p1: { name: 'Red', red: 1, green: 0, blue: 0 },
                                    p2: { name: 'Green', red: 0, green: 1, blue: 0 },
                                },
                            },
                        },
                    },
                },
            },
        })
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const presets = wrapper.findAllComponents({ name: 'MiscellaneousLightNeopixelDialogPreset' })
        expect(presets.length).toBe(2)
    })

    it('does not render presets section when no presets', () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.findAllComponents({ name: 'MiscellaneousLightNeopixelDialogPreset' }).length).toBe(0)
    })

    it('renders RGB color picker', () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        // GRB includes G, R, B - so should show color picker with RGB
        expect(wrapper.find('.color-picker-stub').exists()).toBe(true)
    })

    it('handles led type with pin-based color detection', () => {
        store = createStore({
            state: {
                printer: {
                    configfile: {
                        settings: {
                            'led my_led': {
                                red_pin: 'PA1',
                                green_pin: 'PA2',
                                blue_pin: 'PA3',
                                initial_red: 1,
                                initial_green: 0,
                                initial_blue: 0,
                            },
                        },
                    },
                    'led my_led': { color_data: [[1, 0, 0, 0]] },
                },
                gui: { miscellaneous: { entries: {} } },
            },
        })
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'led', name: 'my_led' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel-title').text()).toBe('My Led')
    })

    it('handles missing configfile settings gracefully', () => {
        store = createStore({
            state: {
                printer: {
                    configfile: { settings: {} },
                },
                gui: { miscellaneous: { entries: {} } },
            },
        })
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            props: { modelValue: true, type: 'neopixel', name: 'unknown_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })
})
