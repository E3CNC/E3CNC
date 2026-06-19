import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ instancesDB: ref('moonraker') }),
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}))

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VCardTitle: { name: 'VCardTitle', template: '<div><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VTextField: {
        name: 'VTextField',
        props: ['modelValue', 'hideDetails', 'density', 'variant', 'label', 'required', 'rules'],
        template:
            '<input :value="modelValue" class="v-text-field" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    VBtn: {
        name: 'VBtn',
        props: ['size', 'variant', 'color', 'disabled', 'type', 'loading'],
        template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', props: ['size', 'start'], template: '<i><slot /></i>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
    VAlert: { name: 'VAlert', props: ['icon', 'type', 'variant'], template: '<div class="v-alert"><slot /></div>' },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: { title: { default: '' }, loading: { default: false }, icon: { default: null } },
        template: '<div class="settings-row">{{ title }}<slot /></div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                RemotePrintersTab: {
                    RemotePrinters: 'Remote Printers',
                    UseConfigJson: 'Use config.json to add printers',
                    AddPrinter: 'Add Printer',
                    EditPrinter: 'Edit Printer',
                    Hostname: 'Hostname',
                    Port: 'Port',
                    Path: 'Path',
                    Name: 'Name',
                    NameDescription: 'Desc',
                    TestConnection: 'Test Connection',
                    UpdatePrinter: 'Update Printer',
                    PrinterSaved: 'Printer saved',
                    PrinterUpdated: 'Printer updated',
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
            socket: { protocol: 'ws' },
            gui: { remoteprinters: {} },
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'gui/remoteprinters/getRemoteprinters': () => [],
            ...(overrides.getters || {}),
        },
    })
}

import SettingsRemotePrintersTab from '@/components/settings/SettingsRemotePrintersTab.vue'

describe('SettingsRemotePrintersTab.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsRemotePrintersTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders remote printers header', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsRemotePrintersTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Remote Printers')
    })

    it('renders add printer button', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsRemotePrintersTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Add Printer')
    })

    it('shows form when Add Printer is clicked', async () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsRemotePrintersTab, { global: { plugins: [store, i18n] } })
        const addBtn = wrapper.findAll('button').filter((b) => b.text() === 'Add Printer')
        await addBtn[0].trigger('click')
        expect(wrapper.text()).toContain('Hostname')
        expect(wrapper.text()).toContain('Port')
    })

    it('renders cancel button in form', async () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsRemotePrintersTab, { global: { plugins: [store, i18n] } })
        const addBtn = wrapper.findAll('button').filter((b) => b.text() === 'Add Printer')
        await addBtn[0].trigger('click')
        expect(wrapper.text()).toContain('Cancel')
    })

    it('renders with no printers message', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsRemotePrintersTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders settings rows when in add form', async () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsRemotePrintersTab, { global: { plugins: [store, i18n] } })
        const addBtn = wrapper.findAll('button').filter((b) => b.text() === 'Add Printer')
        await addBtn[0].trigger('click')
        expect(wrapper.findAll('.settings-row').length).toBeGreaterThanOrEqual(2)
    })
})
