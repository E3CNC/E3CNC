import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import HistoryListEntryJob from '@/components/panels/History/HistoryListEntryJob.vue'

const mockBaseValues = vi.hoisted(() => {
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
        apiUrl: new MockRef('//localhost:8080'),
        klipperReadyForGui: new MockRef(true),
        printerIsPrinting: new MockRef(false),
        moonrakerComponents: new MockRef([]),
        formatDateTime: new MockRef((ts: number) => new Date(ts).toISOString()),
    }
})

vi.mock('@/composables/useBase', () => ({
    useBase: () => mockBaseValues,
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

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({
        info: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VCheckbox: {
        name: 'VCheckbox',
        props: ['modelValue', 'density', 'hideDetails', 'ripple'],
        template: '<input type="checkbox" :checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)" />',
    },
    VIcon: { name: 'VIcon', props: ['start', 'icon', 'size', 'color', 'disabled'], template: '<i><slot /></i>' },
    VProgressCircular: {
        name: 'VProgressCircular',
        props: ['indeterminate', 'color'],
        template: '<span><slot /></span>',
    },
    VTooltip: {
        name: 'VTooltip',
        props: ['location', 'top', 'text'],
        template: '<div><slot name="activator" :props="{}" /><slot /></div>',
    },
    VMenu: {
        name: 'VMenu',
        props: ['modelValue', 'positionX', 'positionY', 'absolute', 'offsetY'],
        template: '<div><slot /></div>',
    },
    VList: { name: 'VList', template: '<div><slot /></div>' },
    VListItem: { name: 'VListItem', props: ['disabled'], template: '<div @click="$attrs.onClick"><slot /></div>' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@/plugins/eventBus', () => ({
    EventBus: {
        $emit: vi.fn(),
        $on: vi.fn(),
        $off: vi.fn(),
    },
    CLOSE_CONTEXT_MENU: 'closeContextMenu',
}))

vi.mock('@/directives/longpress', () => ({
    default: {
        mounted: vi.fn(),
        unmounted: vi.fn(),
    },
}))

vi.mock('vue-load-image', () => ({
    default: {
        name: 'VueLoadImage',
        template:
            '<div class="vue-load-image"><slot name="image" /><slot name="preloader" /><slot name="error" /></div>',
    },
}))

vi.mock('@/components/dialogs/HistoryListPanelDetailsDialog.vue', () => ({
    default: {
        name: 'HistoryListPanelDetailsDialog',
        props: ['modelValue', 'job'],
        template: '<div class="details-dialog" />',
    },
}))

vi.mock('@/components/dialogs/HistoryListPanelNoteDialog.vue', () => ({
    default: {
        name: 'HistoryListPanelNoteDialog',
        props: ['modelValue', 'type', 'job'],
        template: '<div class="note-dialog" />',
    },
}))

vi.mock('@/components/dialogs/AddBatchToQueueDialog.vue', () => ({
    default: {
        name: 'AddBatchToQueueDialog',
        props: ['modelValue', 'showToast', 'filename'],
        template: '<div class="add-batch-dialog" />',
    },
}))

vi.mock('@/components/dialogs/StartPrintDialog.vue', () => ({
    default: {
        name: 'StartPrintDialog',
        props: ['modelValue', 'file', 'currentPath'],
        template: '<div class="start-print-dialog" />',
    },
}))

function createStoreWithState(overrides: Record<string, any> = {}): any {
    return createStore({
        state: {
            socket: { isConnected: false, initializationList: [], loadings: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: [] },
            printer: {
                print_stats: { state: 'ready' },
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
            'files/getFile': () => () => undefined,
            'gui/getPanelExpand': () => () => true,
            ...(overrides.getters || {}),
        },
    })
}

function createMockJob(overrides: Record<string, any> = {}) {
    return {
        job_id: 'job_123',
        filename: 'test_print.gcode',
        status: 'completed',
        start_time: 1000000,
        end_time: 1005000,
        print_duration: 4500,
        total_duration: 4500,
        filament_used: 500,
        exists: true,
        metadata: {
            thumbnails: [],
            modified: 1000000,
            slicer: 'Cura',
            size: 1024,
        },
        ...overrides,
    }
}

describe('HistoryListEntryJob.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders filename and status icon', () => {
        const store = createStoreWithState()
        const item = createMockJob()
        const wrapper = mount(HistoryListEntryJob, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('test_print.gcode')
    })

    it('renders with table fields', () => {
        const store = createStoreWithState()
        const item = createMockJob()
        const tableFields = [
            {
                title: 'Size',
                key: 'size',
                text: 'Size',
                value: 'size',
                align: 'left',
                configable: true,
                visible: true,
                outputType: 'filesize',
            },
            {
                title: 'Print Time',
                key: 'print_duration',
                text: 'Print Time',
                value: 'print_duration',
                align: 'left',
                configable: true,
                visible: true,
                outputType: 'time',
            },
        ]
        const wrapper = mount(HistoryListEntryJob, {
            props: {
                item,
                tableFields,
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('test_print.gcode')
        expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
    })

    it('applies text-disabled class when file does not exist', () => {
        const store = createStoreWithState()
        const item = createMockJob({ exists: false })
        const wrapper = mount(HistoryListEntryJob, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        const tr = wrapper.find('tr')
        expect(tr.classes()).toContain('text-disabled')
    })

    it('renders even without thumbnails', () => {
        const store = createStoreWithState()
        const item = createMockJob()
        const wrapper = mount(HistoryListEntryJob, {
            props: {
                item,
                tableFields: [],
                isSelected: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('tr').exists()).toBe(true)
    })
})
