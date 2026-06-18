import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: ref(true),
        moonrakerComponents: ref(['timelapse']),
    }),
}))

vi.mock('@/composables/useConsole', () => ({
    useConsole: () => ({}),
}))

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VCardTitle: { name: 'VCardTitle', template: '<div><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VSelect: {
        name: 'VSelect',
        props: ['modelValue', 'items', 'itemTitle', 'itemValue', 'multiple', 'hideDetails', 'density', 'variant'],
        template:
            '<select class="v-select" :value="modelValue"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.text }}</option></select>',
    },
    VTextField: {
        name: 'VTextField',
        props: ['modelValue', 'hideDetails', 'variant', 'density', 'rules'],
        template: '<input :value="modelValue" class="v-text-field" />',
    },
    VTextarea: {
        name: 'VTextarea',
        props: ['modelValue', 'variant', 'hideDetails'],
        template: '<textarea class="v-textarea" :value="modelValue" />',
    },
    VSlider: {
        name: 'VSlider',
        props: ['modelValue', 'hideDetails', 'min', 'max', 'step', 'label'],
        template: '<div class="v-slider">{{ label }}</div>',
    },
    VSwitch: {
        name: 'VSwitch',
        props: ['modelValue', 'hideDetails'],
        template: '<div class="v-switch" />',
    },
    VBtn: {
        name: 'VBtn',
        props: ['size', 'variant', 'color', 'type', 'disabled'],
        template:
            '<button :disabled="disabled" :data-color="color" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', props: ['size', 'start'], template: '<i><slot /></i>' },
    VForm: { name: 'VForm', template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
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
                ConsoleTab: {
                    Console: 'Console',
                    Direction: 'Direction',
                    DirectionTable: 'Table',
                    DirectionShell: 'Shell',
                    EntryStyle: 'Entry Style',
                    EntryStyleDefault: 'Default',
                    EntryStyleCompact: 'Compact',
                    Height: 'Height',
                    Filters: 'Filters',
                    HideTimelapse: 'Hide Timelapse Commands',
                    AddFilter: 'Add Filter',
                    CreateHeadline: 'Create Filter',
                    EditHeadline: 'Edit Filter',
                    Name: 'Name',
                    Regex: 'Regex',
                    StoreButton: 'Save',
                    UpdateButton: 'Update',
                },
                Edit: 'Edit',
            },
            Buttons: { Cancel: 'Cancel' },
        },
    },
})

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: [] },
            printer: { print_stats: { state: 'ready' } },
            gui: {
                console: {
                    direction: 'table',
                    entryStyle: 'default',
                    height: 300,
                    hideTlCommands: false,
                    consolefilters: [],
                },
                ...overrides,
            },
            instancesDB: 'moonraker',
        },
        getters: {
            'gui/console/getConsolefilters': () => [],
            ...(overrides.getters || {}),
        },
    })
}

import SettingsConsoleTab from '@/components/settings/SettingsConsoleTab.vue'

describe('SettingsConsoleTab.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsConsoleTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders console header and direction setting', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsConsoleTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Console')
        expect(wrapper.text()).toContain('Direction')
    })

    it('renders entry style setting', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsConsoleTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Entry Style')
    })

    it('renders console height slider', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsConsoleTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.find('.v-slider').exists()).toBe(true)
    })

    it('renders filters header', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsConsoleTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Filters')
    })

    it('renders hide timelapse switch when timelapse component available', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsConsoleTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Hide Timelapse Commands')
    })

    it('renders add filter button', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsConsoleTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Add Filter')
    })

    it('shows create filter form when Add Filter is clicked', async () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsConsoleTab, {
            global: { plugins: [store, i18n] },
        })
        const addBtn = wrapper.findAll('button').filter((b) => b.text() === 'Add Filter')
        await addBtn[0].trigger('click')

        expect(wrapper.text()).toContain('Create Filter')
        expect(wrapper.text()).toContain('Cancel')
    })
})
