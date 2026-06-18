import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ isMobile: ref(false) }),
}))

vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({ theme: ref({ colorLogo: '#fff', colorPrimary: '#1976d2' }) }),
}))

vi.mock('@/store/variables', () => ({
    defaultLogoColor: '#fff',
    defaultPrimaryColor: '#1976d2',
    themes: [
        { name: 'mainsail', displayName: 'Mainsail', colorLogo: '#fff', colorPrimary: '#1976d2' },
        { name: 'fluidd', displayName: 'Fluidd', colorLogo: '#00ae42', colorPrimary: '#00ae42' },
    ],
}))

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VSelect: {
        name: 'VSelect',
        props: ['modelValue', 'items', 'itemTitle', 'itemValue', 'multiple', 'hideDetails', 'density', 'variant'],
        template: '<select class="v-select" :value="modelValue"></select>',
    },
    VSwitch: { name: 'VSwitch', props: ['modelValue', 'hideDetails'], template: '<div class="v-switch" />' },
    VSlider: { name: 'VSlider', props: ['modelValue', 'hideDetails', 'min', 'max', 'step', 'label'], template: '<div class="v-slider" />' },
    VBtn: { name: 'VBtn', props: ['size', 'variant', 'color', 'class'], template: '<button @click="$emit(\'click\', $event)"><slot /></button>' },
    VIcon: { name: 'VIcon', props: ['size', 'start'], template: '<i><slot /></i>' },
    VMenu: { name: 'VMenu', props: ['location', 'closeOnContentClick'], template: '<div class="v-menu"><slot name="activator" /><slot /></div>' },
    VColorPicker: { name: 'VColorPicker', props: ['value', 'hideModeSwitch', 'mode'], template: '<div />' },
    VExpandTransition: { name: 'VExpandTransition', template: '<div><slot /></div>' },
    VTextField: { name: 'VTextField', props: ['modelValue'], template: '<input class="v-text-field" :value="modelValue" />' },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: { title: { default: '' } },
        template: '<div class="settings-row">{{ title }}</div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                UiSettingsTab: {
                    Mode: 'Mode',
                    Theme: 'Theme',
                    Logo: 'Logo',
                    Primary: 'Primary Color',
                    ProgressAsFavicon: 'Progress as Favicon',
                    LockSliders: 'Lock Sliders',
                    ConfirmOnEmergencyStop: 'Confirm Emergency Stop',
                    NavigationStyle: 'Navigation Style',
                    DefaultNavigationState: 'Default Nav State',
                },
            },
        },
    },
})

function createStoreWithState() {
    return createStore({
        state: {
            gui: {
                uiSettings: {
                    mode: 'dark', theme: 'mainsail', logo: '#fff', primary: '#1976d2',
                    progressAsFavicon: false, lockSlidersOnTouchDevices: false, lockSlidersDelay: 3,
                    confirmOnEmergencyStop: true, confirmOnCoolDown: true, confirmOnPowerDeviceChange: true, confirmOnCancelJob: true,
                    navigationStyle: 'iconsAndText', defaultNavigationStateSetting: 'lastState',
                    powerDeviceName: null, hideUpdateWarnings: false,
                    dashboardFilesLimit: 5, dashboardFilesFilter: [], dashboardHistoryLimit: 5, hideOtherInstances: false,
                },
            },
            instancesDB: 'moonraker',
        },
        getters: { 'gui/theme': () => 'mainsail', 'server/power/getDevices': () => [] },
    })
}

import SettingsUiSettingsTab from '@/components/settings/SettingsUiSettingsTab.vue'

describe('SettingsUiSettingsTab.vue', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsUiSettingsTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders mode setting', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsUiSettingsTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Mode')
    })

    it('renders theme setting', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsUiSettingsTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Theme')
    })

    it('renders toggle settings', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsUiSettingsTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Progress as Favicon')
        expect(wrapper.text()).toContain('Lock Sliders')
        expect(wrapper.text()).toContain('Confirm Emergency Stop')
    })

    it('renders navigation style select', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsUiSettingsTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Navigation Style')
    })

    it('renders settings rows', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsUiSettingsTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.findAll('.settings-row').length).toBeGreaterThan(5)
    })
})
