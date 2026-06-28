import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import TheConnectingDialog from '@/components/TheConnectingDialog.vue'

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            ConnectionDialog: {
                Failed: 'Connection failed: {host}',
                Connecting: 'Connecting to {host}',
                Initializing: 'Initializing...',
                CannotConnectTo: 'Cannot connect to {host}',
                ErrorMessage: 'Error: {message}',
                CheckMoonrakerLog: 'Check the moonraker log',
                Help: 'Help',
                TryAgain: 'Try again',
            },
        },
    },
})

vi.mock('@/composables/useBase', () => ({ useBase: () => ({ guiIsReady: { value: true } }) }))
vi.mock('@/composables/useTheme', () => ({ useTheme: () => ({ progressBarColor: { value: 'primary' } }) }))
vi.mock('@/composables/useSocket', () => ({ useSocket: () => ({ connect: vi.fn() }) }))

vi.mock('@mdi/js', () => ({ mdiConnection: 'connection-icon', mdiHelp: 'help-icon' }))

vi.mock('@/components/ui/ConnectionStatus.vue', () => ({
    default: { name: 'ConnectionStatus', props: { moonraker: Boolean }, template: '<div class="connection-status" />' },
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: { modelValue: Boolean, persistent: Boolean, width: [String, Number] },
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: { href: String, target: String, class: String },
        template: '<button class="v-btn" @click="$emit(`click`)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', props: { start: Boolean }, template: '<i class="v-icon"><slot /></i>' },
    VProgressLinear: {
        name: 'VProgressLinear',
        props: { color: [String, Boolean], indeterminate: Boolean },
        template: '<div class="v-progress-linear" />',
    },
    VDivider: { name: 'VDivider', template: '<hr />' },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: String, cardClass: String, marginBottom: Boolean },
        template: '<div class="panel"><span class="panel-title">{{ title }}</span><slot /></div>',
    },
}))

function makeStore(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: {
                hostname: '192.168.1.100',
                port: '80',
                path: '/',
                isConnecting: true,
                connectingFailed: false,
                connectionFailedMessage: null,
                ...overrides,
            },
        },
        mutations: {},
        actions: { 'socket/setData': vi.fn() },
    })
}

describe('TheConnectingDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('mounts without crashing', () => {
        const wrapper = mount(TheConnectingDialog, { global: { plugins: [makeStore(), i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('always shows the dialog (showDialog is always true)', () => {
        const wrapper = mount(TheConnectingDialog, { global: { plugins: [makeStore(), i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('shows connecting message with hostname and port', () => {
        const wrapper = mount(TheConnectingDialog, { global: { plugins: [makeStore({ port: '7125' }), i18n] } })
        const text = wrapper.find('.panel-title').text()
        expect(text).toContain('Connecting to')
        expect(text).toContain('192.168.1.100:7125')
    })

    it('shows connecting message with path when port is default', () => {
        const wrapper = mount(TheConnectingDialog, { global: { plugins: [makeStore({ path: '/moonraker' }), i18n] } })
        const text = wrapper.find('.panel-title').text()
        expect(text).toContain('192.168.1.100/moonraker')
    })

    it('shows failed message with the hostname in title', () => {
        const wrapper = mount(TheConnectingDialog, {
            global: { plugins: [makeStore({ isConnecting: false, connectingFailed: true }), i18n] },
        })
        const text = wrapper.find('.panel-title').text()
        expect(text).toContain('Connection failed')
        expect(text).toContain('192.168.1.100')
    })

    it('shows error message text when connectionFailedMessage is set', () => {
        const wrapper = mount(TheConnectingDialog, {
            global: {
                plugins: [
                    makeStore({ isConnecting: false, connectingFailed: true, connectionFailedMessage: 'Timeout' }),
                    i18n,
                ],
            },
        })
        expect(wrapper.text()).toContain('Error:')
    })

    it('shows help button when connectionFailedMessage is set', () => {
        const wrapper = mount(TheConnectingDialog, {
            global: {
                plugins: [
                    makeStore({ isConnecting: false, connectingFailed: true, connectionFailedMessage: 'Timeout' }),
                    i18n,
                ],
            },
        })
        expect(wrapper.text()).toContain('Help')
        expect(wrapper.text()).toContain('Try again')
    })

    it('shows progress bar when connecting and not failed', () => {
        const wrapper = mount(TheConnectingDialog, {
            global: { plugins: [makeStore({ isConnecting: true, connectingFailed: false }), i18n] },
        })
        expect(wrapper.find('.v-progress-linear').exists()).toBe(true)
    })

    it('does not show progress bar when connection failed', () => {
        const wrapper = mount(TheConnectingDialog, {
            global: { plugins: [makeStore({ isConnecting: false, connectingFailed: true }), i18n] },
        })
        expect(wrapper.find('.v-progress-linear').exists()).toBe(false)
    })

    it('shows connection status component when connection fails', () => {
        const wrapper = mount(TheConnectingDialog, {
            global: { plugins: [makeStore({ isConnecting: false, connectingFailed: true }), i18n] },
        })
        expect(wrapper.find('.connection-status').exists()).toBe(true)
    })

    it('shows Try Again and buttons when connection failed', () => {
        const wrapper = mount(TheConnectingDialog, {
            global: { plugins: [makeStore({ isConnecting: false, connectingFailed: true }), i18n] },
        })
        expect(wrapper.text()).toContain('Try again')
    })

    it('shows connecting message in title when connecting is true', () => {
        const wrapper = mount(TheConnectingDialog, {
            global: { plugins: [makeStore({ isConnecting: true, connectingFailed: false }), i18n] },
        })
        const title = wrapper.find('.panel-title').text()
        expect(title).toContain('Connecting to')
    })
})
