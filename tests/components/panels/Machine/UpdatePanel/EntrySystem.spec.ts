import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import EntrySystem from '@/components/panels/Machine/UpdatePanel/EntrySystem.vue'

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
    VIcon: { name: 'VIcon', template: '<i class="v-icon" />' },
    VBtn: {
        name: 'VBtn',
        template: '<button :class="$attrs.class" @click="$attrs.onClick || $attrs.click"><slot /></button>',
    },
    VChip: {
        name: 'VChip',
        props: ['size', 'label', 'variant', 'outlined', 'color', 'disabled'],
        template: '<span :class="$attrs.class" @click="$attrs.onClick || $attrs.click"><slot /></span>',
    },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@/components/panels/Machine/UpdatePanel/SystemPackagesList.vue', () => ({
    default: {
        name: 'SystemPackagesList',
        props: ['modelValue', 'packagesList'],
        template: '<div class="system-packages-list" />',
    },
}))

const $t = (key: string) => key

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [] },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                updateManager: {
                    system: {
                        package_count: 0,
                        package_list: [],
                    },
                },
                ...(overrides.server || {}),
            },
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
                uiSettings: {},
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

describe('UpdatePanel EntrySystem.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockBaseValues.printer_state.value = 'ready'
    })

    it('renders system title', () => {
        const store = createStoreWithState()
        const wrapper = mount(EntrySystem, {
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('Machine.UpdatePanel.System')
    })

    it('shows up-to-date status when no packages to upgrade', () => {
        const store = createStoreWithState()
        const wrapper = mount(EntrySystem, {
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('Machine.UpdatePanel.OSPackages')
        expect(wrapper.text()).toContain('Machine.UpdatePanel.UpToDate')
    })

    it('shows upgrade button when packages need upgrade', () => {
        const store = createStoreWithState({
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                updateManager: {
                    system: {
                        package_count: 5,
                        package_list: ['libc6', 'openssl', 'curl', 'git', 'python3'],
                    },
                },
            },
        })
        const wrapper = mount(EntrySystem, {
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('Machine.UpdatePanel.Upgrade')
    })

    it('disables upgrade button when printer is printing', () => {
        mockBaseValues.printer_state.value = 'printing'

        const store = createStoreWithState({
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                updateManager: {
                    system: {
                        package_count: 3,
                        package_list: ['libc6', 'openssl', 'curl'],
                    },
                },
            },
        })
        const wrapper = mount(EntrySystem, {
            global: { plugins: [store], mocks: { $t } },
        })

        const chip = wrapper.findComponent({ name: 'VChip' })
        expect(chip.props('disabled')).toBe(true)
    })

    it('disables upgrade button when no packages to upgrade', () => {
        const store = createStoreWithState()
        const wrapper = mount(EntrySystem, {
            global: { plugins: [store], mocks: { $t } },
        })

        const chip = wrapper.findComponent({ name: 'VChip' })
        expect(chip.props('disabled')).toBe(true)
    })

    it('calls socket.emit when upgrade chip is clicked', async () => {
        const store = createStoreWithState({
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                updateManager: {
                    system: {
                        package_count: 3,
                        package_list: ['libc6', 'openssl', 'curl'],
                    },
                },
            },
        })
        const wrapper = mount(EntrySystem, {
            global: { plugins: [store], mocks: { $t } },
        })

        const chip = wrapper.findComponent({ name: 'VChip' })
        await chip.trigger('click')

        expect(mockSocket.emitAndWait).toHaveBeenCalledWith('machine.update.system', {})
    })

    it('renders SystemPackagesList child component', () => {
        const store = createStoreWithState({
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                updateManager: {
                    system: {
                        package_count: 3,
                        package_list: ['libc6', 'openssl', 'curl'],
                    },
                },
            },
        })
        const wrapper = mount(EntrySystem, {
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.find('.system-packages-list').exists()).toBe(true)
    })
})
