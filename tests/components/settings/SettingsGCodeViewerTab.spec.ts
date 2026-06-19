import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VSwitch: { name: 'VSwitch', props: ['modelValue', 'hideDetails'], template: '<div class="v-switch" />' },
    VBtn: {
        name: 'VBtn',
        props: ['size', 'variant', 'color', 'class'],
        template: '<button @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VMenu: { name: 'VMenu', template: '<div><slot name="activator" /><slot /></div>' },
    VColorPicker: { name: 'VColorPicker', props: ['value', 'hideModeSwitch', 'mode'], template: '<div />' },
    VTextField: {
        name: 'VTextField',
        props: ['modelValue'],
        template: '<input :value="modelValue" class="v-text-field" />',
    },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: { title: { default: '' } },
        template: '<div class="settings-row">{{ title }}<slot /></div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                GCodeViewerTab: {
                    ShowAxes: 'Show Axes',
                    BackgroundColor: 'Background Color',
                    GridColor: 'Grid Color',
                    ProgressColor: 'Progress Color',
                    MinFeed: 'Min Feed',
                    MaxFeed: 'Max Feed',
                },
            },
        },
    },
})

function createStoreWithState() {
    return createStore({
        state: {
            gui: {
                gcodeViewer: {
                    showAxes: true,
                    backgroundColor: '#111111',
                    gridColor: '#333333',
                    progressColor: '#2196f3',
                    minFeed: 5,
                    maxFeed: 100,
                    minFeedColor: '#4caf50',
                    maxFeedColor: '#f44336',
                },
            },
            instancesDB: 'moonraker',
        },
    })
}

import SettingsGCodeViewerTab from '@/components/settings/SettingsGCodeViewerTab.vue'

describe('SettingsGCodeViewerTab.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsGCodeViewerTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders show axes toggle', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsGCodeViewerTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Show Axes')
    })

    it('renders background color setting', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsGCodeViewerTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Background Color')
    })

    it('renders grid color setting', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsGCodeViewerTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Grid Color')
    })

    it('renders progress color setting', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsGCodeViewerTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Progress Color')
    })

    it('renders min feed and max feed settings', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsGCodeViewerTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Min Feed')
        expect(wrapper.text()).toContain('Max Feed')
    })

    it('renders settings rows', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsGCodeViewerTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.findAll('.settings-row').length).toBeGreaterThanOrEqual(6)
    })
})
