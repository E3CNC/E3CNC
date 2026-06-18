import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'

vi.mock('vuetify/components', () => ({
    VForm: { name: 'VForm', template: '<form><slot /></form>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VTextField: { name: 'VTextField', props: ['modelValue'], template: '<input class="v-text-field" :value="modelValue" />' },
    VBtn: { name: 'VBtn', props: ['disabled', 'variant', 'color'], template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: { title: { default: '' } },
        template: '<div class="settings-row">{{ title }}<slot /></div>',
    },
}))

const i18n = createI18n({
    legacy: false, locale: 'en',
    messages: {
        en: {
            Settings: { MiscellaneousTab: { Name: 'Name', Start: 'Start', End: 'End' } },
            Buttons: { Cancel: 'Cancel' },
            Settings: { Store: 'Save', Update: 'Update' },
        },
    },
})

const store = createStore({ state: { instancesDB: 'moonraker', gui: { miscellaneous: {} } } })

import SettingsMiscellaneousTabLightGroupsForm from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroupsForm.vue'

describe('SettingsMiscellaneousTabLightGroupsForm.vue', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders without crashing', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsForm, {
            props: { modelValue: true, lightType: 'neopixel', lightName: 'case' },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders name, start, end fields', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsForm, {
            props: { modelValue: true, lightType: 'neopixel', lightName: 'case' },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.findAll('.settings-row').length).toBeGreaterThanOrEqual(3)
    })
})
