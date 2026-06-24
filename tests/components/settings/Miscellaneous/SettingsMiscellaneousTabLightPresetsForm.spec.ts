import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsMiscellaneousTabLightPresetsForm from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresetsForm.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiDelete: 'mdi-delete',
    mdiPencil: 'mdi-pencil',
}))

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VTextField: { name: 'VTextField', props: ['modelValue', 'hideDetails', 'rules', 'density', 'variant'], template: '<input class="v-text-field" />' },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<div class="v-spacer" />' },
    VBtn: { name: 'VBtn', props: ['variant', 'color', 'disabled'], template: '<button class="v-btn" :disabled="disabled"><slot /></button>' },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: ['title', 'subTitle', 'icon', 'loading'],
        template: '<div class="settings-row"><span class="settings-row-title">{{ title }}</span><slot /></div>',
    },
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
        props: ['label', 'param', 'target', 'min', 'max', 'dec', 'step', 'hasSpinner', 'outputErrorMsg'],
        template: '<div class="number-input-stub">{{ param }}: {{ target }}</div>',
        emits: ['submit'],
    },
}))

vi.mock('@/plugins/helpers', () => ({
    caseInsensitiveSort: (arr: any[], key: string) =>
        [...arr].sort((a: any, b: any) => String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { sensitivity: 'base' })),
}))

vi.mock('@jaames/iro', () => ({
    default: {
        ColorPicker: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), color: { rgbString: '#ffffff' } })),
        ui: { Wheel: {}, Slider: {} },
    },
}))

function createMockStore(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            printer: {
                configfile: {
                    settings: {
                        'neopixel my_strip': {
                            color_order: ['GRB'],
                            chain_count: 10,
                            ...(overrides.configfile ?? {}),
                        },
                    },
                },
            },
            gui: {
                miscellaneous: {
                    entries: overrides.entries ?? {},
                },
            },
        },
    })
}

describe('SettingsMiscellaneousTabLightPresetsForm.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders create title when no presetId', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.MiscellaneousTab.CreatePreset')
    })

    it('renders edit title when presetId is provided', () => {
        const entries = {
            entry1: {
                type: 'neopixel',
                name: 'my_strip',
                presets: {
                    'preset-1': { name: 'Red', red: 255, green: 0, blue: 0, white: 0 },
                },
            },
        }
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsForm, {
            props: { type: 'neopixel', name: 'my_strip', presetId: 'preset-1' },
            global: {
                plugins: [createMockStore({ entries })],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.MiscellaneousTab.EditPreset')
    })

    it('renders cancel and store buttons', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAll('.v-btn')
        expect(buttons.length).toBeGreaterThanOrEqual(2)
    })

    it('renders ColorPicker and NumberInput components', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        // color_order is GRB, so only G, R, B channels
        expect(wrapper.findComponent({ name: 'ColorPicker' }).exists()).toBe(true)
        const inputs = wrapper.findAllComponents({ name: 'NumberInput' })
        expect(inputs.length).toBe(3) // R, G, B from GRB
    })

    it('renders white color picker when color_order includes W', () => {
        const store = createMockStore({
            configfile: { color_order: ['GRBW'] },
        })
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const pickers = wrapper.findAllComponents({ name: 'ColorPicker' })
        expect(pickers.length).toBe(2) // RGB + White
    })

    it('emits close on cancel button click', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const cancelBtn = wrapper.findAll('.v-btn')[0]
        await cancelBtn.trigger('click')
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('dispatches storePreset on store button click', async () => {
        const store = createMockStore()
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const storeBtn = wrapper.findAll('.v-btn')[1]
        await storeBtn.trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/miscellaneous/storePreset', expect.any(Object))
    })

    it('dispatches updatePreset when presetId is provided', async () => {
        const entries = {
            entry1: {
                type: 'neopixel',
                name: 'my_strip',
                presets: {
                    'preset-1': { name: 'Red', red: 255, green: 0, blue: 0, white: 0 },
                },
            },
        }
        const store = createMockStore({ entries })
        const dispatchSpy = vi.spyOn(store, 'dispatch')
        const wrapper = mount(SettingsMiscellaneousTabLightPresetsForm, {
            props: { type: 'neopixel', name: 'my_strip', presetId: 'preset-1' },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const updateBtn = wrapper.findAll('.v-btn')[1]
        await updateBtn.trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/miscellaneous/updatePreset', expect.any(Object))
    })
})
