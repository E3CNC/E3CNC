import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import HistoryListPanelDetailsDialog from '@/components/dialogs/HistoryListPanelDetailsDialog.vue'

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
        formatDateTime: (ts: number) => new Date(ts).toISOString(),
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
        te: (key: string) => key.startsWith('History.StatusValues.'),
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VDialog: {
        name: 'VDialog',
        props: ['modelValue'],
        template: '<div><slot v-if="modelValue" /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VBtn: { name: 'VBtn', props: ['icon', 'rounded'], template: '<button><slot /></button>' },
    VIcon: { name: 'VIcon', props: ['icon'], template: '<i><slot /></i>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['icon', 'title', 'cardClass', 'marginBottom'],
        template: '<div :class="cardClass"><slot name="buttons" /><slot /></div>',
    },
}))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: {
        name: 'OverlayScrollbarsComponent',
        template: '<div><slot /></div>',
    },
}))

function createMockJob(overrides: Record<string, any> = {}) {
    return {
        job_id: 'job_123',
        filename: 'test_print.gcode',
        exists: true,
        status: 'completed',
        start_time: 1000000,
        end_time: 1005000,
        print_duration: 4500,
        total_duration: 5000,
        filament_used: 500,
        metadata: {
            filesize: 1048576,
            modified: 999000,
            estimated_time: 4600,
            filament_weight_total: 50.5,
            filament_total: 10000,
            filament_used: 500,
            first_layer_extr_temp: 210,
            first_layer_bed_temp: 60,
            first_layer_height: 0.2,
            layer_height: 0.2,
            object_height: 50,
            slicer: 'Cura',
            slicer_version: '5.0',
        },
        ...overrides,
    }
}

describe('HistoryListPanelDetailsDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders when modelValue is true', () => {
        const job = createMockJob()
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('.history-detail-dialog').exists()).toBe(true)
    })

    it('does not render when modelValue is false', () => {
        const job = createMockJob()
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: false,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // VDialog should not render content when modelValue is false
        expect(wrapper.find('.history-detail-dialog').exists()).toBe(false)
    })

    it('displays filename', () => {
        const job = createMockJob()
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.Filename')
        expect(wrapper.text()).toContain('test_print.gcode')
    })

    it('displays status text', () => {
        const job = createMockJob({ status: 'completed' })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.Status')
        // Status translation exists for "completed" key
        expect(wrapper.text()).toContain('History.StatusValues.completed')
    })

    it('shows raw status when translation not available', () => {
        const job = createMockJob({ status: 'nonexistent_status' })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('nonexistent_status')
    })

    it('displays filesize when metadata.filesize > 0', () => {
        const job = createMockJob({ metadata: { filesize: 1048576, modified: 0 } })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.Filesize')
    })

    it('hides filesize row when filesize is 0', () => {
        const job = createMockJob({
            metadata: { filesize: 0, modified: 999000, estimated_time: 4600 },
        })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // Filesize row should be hidden (exists=false)
        expect(wrapper.text()).not.toContain('History.Filesize')
    })

    it('displays start and end time', () => {
        const job = createMockJob({ start_time: 1000000, end_time: 1005000 })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.StartTime')
        expect(wrapper.text()).toContain('History.EndTime')
    })

    it('hides end time when end_time is 0', () => {
        const job = createMockJob({ end_time: 0 })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.StartTime')
        expect(wrapper.text()).not.toContain('History.EndTime')
    })

    it('displays print duration when > 0', () => {
        const job = createMockJob({ print_duration: 4500 })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.PrintDuration')
    })

    it('hides print duration when 0', () => {
        const job = createMockJob({ print_duration: 0 })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).not.toContain('History.PrintDuration')
    })

    it('displays filament weight when metadata has filament_weight_total', () => {
        const job = createMockJob({
            metadata: { filament_weight_total: 50.5, filesize: 0, modified: 0 },
        })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('50.5 g')
    })

    it('displays slicer info', () => {
        const job = createMockJob({
            metadata: {
                slicer: 'Cura',
                slicer_version: '5.0',
                filesize: 0,
                modified: 0,
            },
        })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.Slicer')
        expect(wrapper.text()).toContain('Cura')
        expect(wrapper.text()).toContain('History.SlicerVersion')
        expect(wrapper.text()).toContain('5.0')
    })

    it('shows auxiliary data when present', () => {
        const job = createMockJob({
            auxiliary_data: [
                {
                    description: 'My Custom Data',
                    value: 42,
                    units: 'mm',
                    name: 'custom',
                    provider: 'test',
                },
            ],
        })
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('My Custom Data')
        expect(wrapper.text()).toContain('42 mm')
    })

    it('emits update:modelValue false on close', async () => {
        const job = createMockJob()
        const wrapper = mount(HistoryListPanelDetailsDialog, {
            props: {
                modelValue: true,
                job,
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        const closeButton = wrapper.find('button')
        expect(closeButton.exists()).toBe(true)
        await closeButton.trigger('click')

        const emitted = wrapper.emitted('update:modelValue')
        expect(emitted).toBeTruthy()
        if (emitted) {
            expect(emitted[0]).toEqual([false])
        }
    })
})
