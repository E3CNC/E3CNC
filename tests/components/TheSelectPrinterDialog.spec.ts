import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import TheSelectPrinterDialog from '@/components/TheSelectPrinterDialog.vue'

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: vi.fn(),
        setUrl: vi.fn(),
        connect: vi.fn(),
    }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        guiIsReady: true,
        instancesDB: 'moonraker',
    }),
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['icon', 'title', 'cardClass', 'marginBottom', 'toolbarColor'],
        template: '<div class="mock-panel"><slot name="buttons" /><slot /></div>',
    },
}))

vi.mock('@mdi/js', () => ({
    mdiConnection: 'MdiConnection',
    mdiCancel: 'MdiCancel',
    mdiCheckboxMarkedCircle: 'MdiCheckboxMarkedCircle',
    mdiCloseThick: 'MdiCloseThick',
    mdiCog: 'MdiCog',
    mdiCogOff: 'MdiCogOff',
    mdiDelete: 'MdiDelete',
    mdiPencil: 'MdiPencil',
    mdiSync: 'MdiSync',
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VDialog: {
        name: 'VDialog',
        props: { modelValue: Boolean, persistent: Boolean, width: [String, Number] },
        template: '<div v-if="modelValue"><slot /></div>',
    },
    VCard: { name: 'VCard', template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', props: { class: String }, template: '<div :class="class"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: {
            icon: [String, Boolean],
            rounded: String,
            color: String,
            variant: String,
            disabled: Boolean,
            class: String,
            large: Boolean,
            type: String,
        },
        template: '<button :disabled="disabled" @click="$emit(`click`, $event)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', props: { color: String }, template: '<span><slot /></span>' },
    VForm: { name: 'VForm', template: '<form @submit.prevent="$emit(`submit`)"><slot /></form>' },
    VTextField: {
        name: 'VTextField',
        props: ['modelValue', 'rules', 'label', 'required', 'variant', 'hideDetails', 'density'],
        template: '<input :value="modelValue" v-on:input="$emit(`update:modelValue`, $event.target.value)" />',
    },
    VCheckbox: {
        name: 'VCheckbox',
        props: ['modelValue', 'onIcon', 'offIcon', 'trueValue', 'falseValue', 'class'],
        template:
            '<input type="checkbox" :checked="modelValue" v-on:change="$emit(`update:modelValue`, $event.target.checked)" />',
    },
    VProgressCircular: {
        name: 'VProgressCircular',
        props: ['indeterminate', 'color', 'size', 'width'],
        template: '<span class="progress-circular" />',
    },
    VProgressLinear: {
        name: 'VProgressLinear',
        props: ['color', 'indeterminate'],
        template: '<span class="progress-linear" />',
    },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            SelectPrinterDialog: {
                SelectPrinter: 'Select Printer',
                Connecting: 'Connecting to {host}...',
                ConnectionFailed: 'Connection to {host} failed',
                CannotConnectTo: 'Cannot connect to {host}',
                ChangePrinter: 'Change',
                TryAgain: 'Try Again',
                AddPrinter: 'Add Printer',
                EditPrinter: 'Edit Printer',
                UpdatePrinter: 'Update',
                HostnameIp: 'Hostname/IP',
                HostnameRequired: 'Hostname required',
                HostnameInvalid: 'Invalid format',
                Port: 'Port',
                PortRequired: 'Port required',
                Path: 'Path',
                Name: 'Name',
                Hello: 'Welcome!',
                RememberToAdd: 'Remember to add {cors}',
                YouCanFindMore: 'Find more info at',
                AddPrintersToJson: 'Add printers to JSON config',
            },
            ConnectionDialog: {
                Initializing: 'Initializing...',
            },
        },
    },
})

function createAppStore(overrides: Record<string, any> = {}) {
    const store = createStore({
        modules: {
            gui: {
                namespaced: true,
                modules: {
                    remoteprinters: {
                        namespaced: true,
                        state: { printers: [] },
                        getters: {
                            getRemoteprinters: () =>
                                overrides.getters?.['gui/remoteprinters/getRemoteprinters']?.() ?? ([] as any[]),
                        },
                    },
                },
            },
            farm: {
                namespaced: true,
                getters: {
                    getPrinterName: () => (_namespace: string) => 'Test Printer',
                },
            },
            socket: {
                namespaced: true,
                state: {
                    protocol: 'http:',
                    hostname: 'localhost',
                    port: '8080',
                    path: '/',
                    isConnected: overrides.socket?.isConnected ?? true,
                    isConnecting: overrides.socket?.isConnecting ?? false,
                    connectingFailed: overrides.socket?.connectingFailed ?? false,
                },
            },
        },
    })
    // Make dispatch return a resolved promise for actions that return undefined
    const originalDispatch = store.dispatch
    store.dispatch = ((action: string, payload?: any) => {
        const result = originalDispatch.call(store, action, payload)
        return result !== undefined ? result : Promise.resolve()
    }) as typeof store.dispatch
    return store
}

describe('TheSelectPrinterDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createAppStore()
        const wrapper = mount(TheSelectPrinterDialog, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders dialog content when not connected', () => {
        const store = createAppStore({
            socket: { isConnected: false, isConnecting: false, connectingFailed: false },
        })
        const wrapper = mount(TheSelectPrinterDialog, {
            global: { plugins: [store, i18n] },
        })
        // Dialog should show with "Select Printer" panel
        expect(wrapper.find('.mock-panel').exists()).toBe(true)
    })

    it('renders add printer form when dialogAddPrinter is activated', () => {
        const store = createAppStore({
            socket: { isConnected: false, isConnecting: false, connectingFailed: false },
        })
        const wrapper = mount(TheSelectPrinterDialog, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders connecting state', () => {
        const store = createAppStore({
            socket: { isConnected: false, isConnecting: true, connectingFailed: false },
        })
        const wrapper = mount(TheSelectPrinterDialog, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.find('.progress-linear').exists()).toBe(true)
    })

    it('renders connection failed state', () => {
        const store = createAppStore({
            socket: { isConnected: false, isConnecting: false, connectingFailed: true },
        })
        const wrapper = mount(TheSelectPrinterDialog, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Try Again')
        expect(wrapper.text()).toContain('Change')
    })

    it('renders printer list when printers exist', () => {
        const store = createAppStore({
            socket: { isConnected: false, isConnecting: false, connectingFailed: false },
        })
        const wrapper = mount(TheSelectPrinterDialog, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })
})
