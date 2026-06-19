import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VTextField: {
        name: 'VTextField',
        props: ['modelValue', 'appendIcon', 'label', 'hideDetails', 'density', 'variant', 'clearable'],
        template:
            '<div class="v-text-field"><label>{{ label }}</label><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>',
    },
    VSwitch: { name: 'VSwitch', props: ['modelValue', 'hideDetails'], template: '<div class="v-switch" />' },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: { title: { default: '' }, subTitle: { default: null } },
        template: '<div class="settings-row">{{ title }}<slot /></div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                MacrosTab: {
                    Macros: 'Macros',
                    Search: 'Search',
                    NOMacros: 'No macros available',
                },
            },
        },
    },
})

function createStoreWithState() {
    return createStore({
        state: {
            gui: {
                macros: {
                    hiddenMacros: [],
                },
            },
            printer: {
                configfile: {
                    settings: {},
                },
            },
        },
        getters: {
            'printer/getMacros': () => [
                { name: 'START_PRINT', description: 'Start print', macros: [] },
                { name: 'END_PRINT', description: 'End print', macros: [] },
            ],
        },
    })
}

import SettingsMacrosTabSimple from '@/components/settings/SettingsMacrosTabSimple.vue'

describe('SettingsMacrosTabSimple.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMacrosTabSimple, { global: { plugins: [store, i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders macros header', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMacrosTabSimple, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Macros')
    })

    it('renders search field', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMacrosTabSimple, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Search')
    })

    it('renders macro entries', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMacrosTabSimple, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('START_PRINT')
        expect(wrapper.text()).toContain('END_PRINT')
    })
})
