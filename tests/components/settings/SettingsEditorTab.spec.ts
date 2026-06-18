import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VSelect: {
        name: 'VSelect',
        props: ['modelValue', 'items', 'itemTitle', 'itemValue', 'hideDetails', 'density', 'variant'],
        template:
            '<select class="v-select" :value="modelValue"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.text }}</option></select>',
    },
    VSwitch: {
        name: 'VSwitch',
        props: ['modelValue', 'hideDetails'],
        template: '<div class="v-switch" />',
    },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: { title: { default: '' }, subTitle: { default: null }, dynamicSlotWidth: { default: false } },
        template: '<div class="settings-row">{{ title }}<slot /></div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                EditorTab: {
                    UseEscToClose: 'Use Esc to Close',
                    UseEscToCloseDescription: 'Description',
                    ConfirmUnsavedChanges: 'Confirm Unsaved Changes',
                    ConfirmUnsavedChangesDescription: 'Description',
                    TabSize: 'Tab Size',
                    TabSizeDescription: 'Description',
                    KlipperRestartMethod: 'Klipper Restart Method',
                    KlipperRestartMethodDescription: 'Description',
                    Spaces: '{count} spaces',
                },
            },
        },
    },
})

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            gui: {
                editor: {
                    escToClose: true,
                    confirmUnsavedChanges: true,
                    tabSize: 4,
                    klipperRestartMethod: 'FIRMWARE_RESTART',
                },
                ...overrides,
            },
            instancesDB: 'moonraker',
        },
    })
}

import SettingsEditorTab from '@/components/settings/SettingsEditorTab.vue'

describe('SettingsEditorTab.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsEditorTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders esc to close switch', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsEditorTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Use Esc to Close')
    })

    it('renders confirm unsaved changes switch', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsEditorTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Confirm Unsaved Changes')
    })

    it('renders tab size select', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsEditorTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Tab Size')
    })

    it('renders klipper restart method select', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsEditorTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Klipper Restart Method')
    })

    it('renders settings rows', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsEditorTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.findAll('.settings-row').length).toBeGreaterThanOrEqual(4)
    })
})
