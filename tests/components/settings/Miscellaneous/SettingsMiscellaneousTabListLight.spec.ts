import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'

vi.mock('vuetify/components', () => ({
    VBtn: { name: 'VBtn', props: ['size', 'variant'], template: '<button @click="$emit(\'click\', $event)"><slot /></button>' },
    VIcon: { name: 'VIcon', props: ['size', 'start'], template: '<i class="v-icon" />' },
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
            Settings: {
                MiscellaneousTab: { Groups: 'Groups', Presets: 'Presets' },
            },
        },
    },
})

function createStoreWithState() {
    return createStore({
        state: {
            printer: { configfile: { settings: { 'neopixel case_led': { chain_count: 2 } } } },
        },
    })
}

import SettingsMiscellaneousTabListLight from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabListLight.vue'

describe('SettingsMiscellaneousTabListLight.vue', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMiscellaneousTabListLight, {
            props: { type: 'neopixel', name: 'case_led' },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders groups and presets buttons', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMiscellaneousTabListLight, {
            props: { type: 'neopixel', name: 'case_led' },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Groups')
        expect(wrapper.text()).toContain('Presets')
    })

    it('emits open-page on groups button click', async () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMiscellaneousTabListLight, {
            props: { type: 'neopixel', name: 'case_led' },
            global: { plugins: [store, i18n] },
        })
        const groupsBtn = wrapper.findAll('button').filter(b => b.text().includes('Groups'))
        await groupsBtn[0].trigger('click')
        expect(wrapper.emitted('open-page')![0]).toEqual([{ page: 'groups', type: 'neopixel', name: 'case_led' }])
    })

    it('emits open-page on presets button click', async () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMiscellaneousTabListLight, {
            props: { type: 'neopixel', name: 'case_led' },
            global: { plugins: [store, i18n] },
        })
        const presetsBtn = wrapper.findAll('button').filter(b => b.text().includes('Presets'))
        await presetsBtn[0].trigger('click')
        expect(wrapper.emitted('open-page')![0]).toEqual([{ page: 'presets', type: 'neopixel', name: 'case_led' }])
    })
})
