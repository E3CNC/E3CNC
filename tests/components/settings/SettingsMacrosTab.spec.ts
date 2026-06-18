import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'

vi.mock('vue-router', () => ({
    useRoute: () => ({ query: {}, path: '/settings', hash: '' }),
    useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div class="v-card"><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VSelect: {
        name: 'VSelect',
        props: ['modelValue', 'items', 'itemTitle', 'itemValue', 'hideDetails', 'density', 'variant'],
        template:
            '<select class="v-select" :value="modelValue"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.text }}</option></select>',
    },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: { title: { default: '' } },
        template: '<div class="settings-row">{{ title }}<slot /></div>',
    },
}))

vi.mock('@/components/settings/SettingsMacrosTabSimple.vue', () => ({
    default: {
        name: 'SettingsMacrosTabSimple',
        template: '<div class="macros-tab-simple">Simple</div>',
    },
}))

vi.mock('@/components/settings/SettingsMacrosTabExpert.vue', () => ({
    default: {
        name: 'SettingsMacrosTabExpert',
        props: ['showGeneral'],
        template: '<div class="macros-tab-expert">Expert</div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                MacrosTab: {
                    General: 'General',
                    Management: 'Management',
                    Simple: 'Simple',
                    Expert: 'Expert',
                },
            },
        },
    },
})

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            gui: {
                macros: { mode: 'simple' },
                ...overrides,
            },
            instancesDB: 'moonraker',
        },
    })
}

import SettingsMacrosTab from '@/components/settings/SettingsMacrosTab.vue'

describe('SettingsMacrosTab.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMacrosTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders general section with management select', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMacrosTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('General')
        expect(wrapper.text()).toContain('Management')
    })

    it('renders simple mode by default', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMacrosTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.find('.macros-tab-simple').exists()).toBe(true)
    })

    it('renders expert mode when store mode is expert', () => {
        const store = createStoreWithState({
            macros: { mode: 'expert' },
        })
        const wrapper = mount(SettingsMacrosTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.find('.macros-tab-expert').exists()).toBe(true)
    })
})
