import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import GcodefilesPanelListCardDirectory from '@/components/panels/Gcodefiles/GcodefilesPanelListCardDirectory.vue'

const mockGcodeFilesValues = vi.hoisted(() => {
    class MockRef {
        _value: any
        __v_isRef = true
        __v_isShallow = false
        constructor(val: any) {
            this._value = val
        }
        get value() {
            return this._value
        }
        set value(v) {
            this._value = v
        }
    }
    return {
        currentPath: new MockRef(''),
        setCurrentPath: vi.fn(),
    }
})

vi.mock('@/composables/useGcodeFiles', () => ({
    useGcodeFiles: () => mockGcodeFilesValues,
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: vi.fn(),
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VCard: {
        name: 'VCard',
        inheritAttrs: false,
        template:
            '<div :class="$attrs.class" :style="$attrs.style" @click="$attrs.onClick || $attrs.click"><slot /></div>',
    },
    VIcon: { name: 'VIcon', props: ['size', 'color'], template: '<i><slot /></i>' },
    VMenu: {
        name: 'VMenu',
        props: ['modelValue', 'positionX', 'positionY', 'absolute', 'offsetY'],
        template: '<div class="v-menu"><slot /><slot name="activator" /></div>',
    },
    VList: { name: 'VList', template: '<div><slot /></div>' },
    VListItem: {
        name: 'VListItem',
        props: ['class'],
        template: '<div :class="$attrs.class" @click="$attrs.onClick || $attrs.click"><slot /></div>',
    },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)
vi.mock('@/components/dialogs/GcodefilesRenameDirectoryDialog.vue', () => ({
    default: {
        name: 'GcodefilesRenameDirectoryDialog',
        props: ['modelValue', 'item'],
        template: '<div v-if="modelValue" class="rename-dir-dialog" />',
    },
}))
vi.mock('@/components/dialogs/ConfirmationDialog.vue', () => ({
    default: {
        name: 'ConfirmationDialog',
        props: ['modelValue', 'title', 'text', 'actionButtonText'],
        template: '<div v-if="modelValue" class="confirmation-dialog">{{ title }}: {{ text }}</div>',
        emits: ['action'],
    },
}))

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
                view: {
                    gcodefiles: {
                        currentPath: '',
                        search: '',
                        showHiddenFiles: false,
                        showCompletedFiles: true,
                        selectedFiles: [],
                        hideMetadataColumns: [],
                        orderMetadataColumns: [],
                    },
                },
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
            'socket/getHostUrl': () => '//localhost:8080',
            'gui/getPanelExpand': () => () => true,
            ...(overrides.getters || {}),
        },
    })
}

describe('GcodefilesPanelListCardDirectory.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGcodeFilesValues.currentPath.value = ''
    })

    it('renders directory card with item name', () => {
        const store = createStoreWithState()
        const item = {
            isDirectory: true,
            filename: 'my_prints',
            modified: new Date('2024-01-01'),
        }

        const wrapper = mount(GcodefilesPanelListCardDirectory, {
            props: { item: item as any },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.find('.gcode-dir-card').exists()).toBe(true)
        expect(wrapper.text()).toContain('my_prints')
    })

    it('renders with children count when available', () => {
        const store = createStoreWithState()
        const item = {
            isDirectory: true,
            filename: 'folder',
            childrens: ['a.gcode', 'b.gcode'],
            modified: new Date('2024-01-01'),
        }

        const wrapper = mount(GcodefilesPanelListCardDirectory, {
            props: { item: item as any },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('2')
    })

    it('renders with fallback when no children count', () => {
        const store = createStoreWithState()
        const item = {
            isDirectory: true,
            filename: 'empty_folder',
            modified: new Date('2024-01-01'),
        }

        const wrapper = mount(GcodefilesPanelListCardDirectory, {
            props: { item: item as any },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('--')
    })

    it('renders with clickable card', async () => {
        const store = createStoreWithState()
        const item = {
            isDirectory: true,
            filename: 'subdir',
            modified: new Date('2024-01-01'),
        }

        const wrapper = mount(GcodefilesPanelListCardDirectory, {
            props: { item: item as any },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const card = wrapper.find('.gcode-dir-card')
        expect(card.exists()).toBe(true)
    })
})
