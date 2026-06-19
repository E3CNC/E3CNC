import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import EntryAll from '@/components/panels/Machine/UpdatePanel/EntryAll.vue'

const mockBaseValues = vi.hoisted(() => ({
    printer_state: { value: 'ready', __v_isRef: true },
}))

const mockSocket = vi.hoisted(() => ({
    emit: vi.fn(),
    emitAndWait: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => mockBaseValues,
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => mockSocket,
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VRow: { name: 'VRow', template: '<div :class="$attrs.class"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div :class="$attrs.class"><slot /></div>' },
    VIcon: { name: 'VIcon', props: ['start'], template: '<i class="v-icon" />' },
    VBtn: {
        name: 'VBtn',
        props: ['variant', 'color', 'size', 'disabled'],
        template: '<button :class="$attrs.class" @click="$attrs.onClick || $attrs.click"><slot /></button>',
    },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@/components/panels/Machine/UpdatePanel/UpdateHintAll.vue', () => ({
    default: {
        name: 'UpdateHintAll',
        props: ['modelValue'],
        template: '<div class="update-hint-all" />',
        emits: ['update:model-value', 'update-all'],
    },
}))

const $t = (key: string) => key

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: [] },
            printer: {
                print_stats: { state: 'standby' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
            },
            gui: {
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                },
                general: { printername: 'Test' },
                control: {},
                uiSettings: { hideUpdateWarnings: false },
                navigationSettings: { entries: [] },
            },
            files: {},
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'gui/getPanelExpand': () => () => true,
            ...(overrides.getters || {}),
        },
    })
}

describe('UpdatePanel EntryAll.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockBaseValues.printer_state.value = 'ready'
    })

    it('renders update all button', () => {
        const store = createStoreWithState()
        const wrapper = mount(EntryAll, {
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('Machine.UpdatePanel.UpdateAll')
    })

    it('disables button when printer is printing', () => {
        mockBaseValues.printer_state.value = 'printing'

        const store = createStoreWithState()
        const wrapper = mount(EntryAll, {
            global: { plugins: [store], mocks: { $t } },
        })

        const btn = wrapper.findComponent({ name: 'VBtn' })
        expect(btn.props('disabled')).toBe(true)
    })

    it('disables button when printer is paused', () => {
        mockBaseValues.printer_state.value = 'paused'

        const store = createStoreWithState()
        const wrapper = mount(EntryAll, {
            global: { plugins: [store], mocks: { $t } },
        })

        const btn = wrapper.findComponent({ name: 'VBtn' })
        expect(btn.props('disabled')).toBe(true)
    })

    it('renders UpdateHintAll child component', () => {
        const store = createStoreWithState()
        const wrapper = mount(EntryAll, {
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.find('.update-hint-all').exists()).toBe(true)
    })

    it('emits machine.update.full when updateAll is called via direct emit', () => {
        const store = createStoreWithState({
            gui: {
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                },
                general: { printername: 'Test' },
                control: {},
                uiSettings: { hideUpdateWarnings: true },
                navigationSettings: { entries: [] },
            },
        })
        const wrapper = mount(EntryAll, {
            global: { plugins: [store], mocks: { $t } },
        })

        const btn = wrapper.findComponent({ name: 'VBtn' })
        btn.trigger('click')

        expect(mockSocket.emitAndWait).toHaveBeenCalledWith('machine.update.full', {})
    })

    it('does not emit directly when hideUpdateWarnings is false', async () => {
        const store = createStoreWithState()
        const wrapper = mount(EntryAll, {
            global: { plugins: [store], mocks: { $t } },
        })

        const btn = wrapper.findComponent({ name: 'VBtn' })
        await btn.trigger('click')

        // socket.emit should NOT be called since hint dialog is shown first
        expect(mockSocket.emitAndWait).not.toHaveBeenCalled()
    })
})
