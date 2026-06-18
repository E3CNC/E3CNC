import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import HistoryListPanelNoteDialog from '@/components/dialogs/HistoryListPanelNoteDialog.vue'

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
    VDialog: {
        name: 'VDialog',
        props: ['modelValue'],
        template: '<div><slot v-if="modelValue" /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VTextarea: {
        name: 'VTextarea',
        props: ['modelValue', 'label', 'hideDetails', 'variant'],
        template:
            '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
    },
    VBtn: { name: 'VBtn', props: ['icon', 'rounded', 'color', 'variant'], template: '<button><slot /></button>' },
    VIcon: { name: 'VIcon', props: ['icon'], template: '<i><slot /></i>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['icon', 'title', 'cardClass', 'marginBottom'],
        template: '<div :class="cardClass"><div v-if="title">{{ title }}</div><slot name="buttons" /><slot /></div>',
    },
}))

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: false, initializationList: [], loadings: [] },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                history: {},
                ...(overrides.server || {}),
            },
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
                ...(overrides.gui || {}),
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

function createMockJob(overrides: Record<string, any> = {}) {
    return {
        job_id: 'job_123',
        filename: 'test_print.gcode',
        status: 'completed',
        note: '',
        start_time: 1000000,
        end_time: 1005000,
        print_duration: 4500,
        total_duration: 5000,
        filament_used: 500,
        exists: true,
        metadata: {},
        ...overrides,
    }
}

describe('HistoryListPanelNoteDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders with "create" title for create type', () => {
        const store = createStoreWithState()
        const job = createMockJob()
        const wrapper = mount(HistoryListPanelNoteDialog, {
            props: {
                modelValue: true,
                type: 'create',
                job,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.CreateNote')
        expect(wrapper.find('.history-note-dialog').exists()).toBe(true)
    })

    it('renders with "edit" title for edit type', () => {
        const store = createStoreWithState()
        const job = createMockJob()
        const wrapper = mount(HistoryListPanelNoteDialog, {
            props: {
                modelValue: true,
                type: 'edit',
                job,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.EditNote')
    })

    it('does not render when modelValue is false', () => {
        const store = createStoreWithState()
        const job = createMockJob()
        const wrapper = mount(HistoryListPanelNoteDialog, {
            props: {
                modelValue: false,
                type: 'create',
                job,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('.history-note-dialog').exists()).toBe(false)
    })

    it('pre-fills note from job when dialog opens', async () => {
        const store = createStoreWithState()
        const job = createMockJob({ note: 'Existing note content' })
        const wrapper = mount(HistoryListPanelNoteDialog, {
            props: {
                modelValue: false,
                type: 'edit',
                job,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // Open dialog
        await wrapper.setProps({ modelValue: true })

        const textarea = wrapper.find('textarea')
        expect(textarea.element.value).toBe('Existing note content')
    })

    it('pre-fills with empty note when job has no note', async () => {
        const store = createStoreWithState()
        const job = createMockJob({ note: undefined })
        const wrapper = mount(HistoryListPanelNoteDialog, {
            props: {
                modelValue: false,
                type: 'create',
                job,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // Open dialog
        await wrapper.setProps({ modelValue: true })

        const textarea = wrapper.find('textarea')
        expect(textarea.element.value).toBe('')
    })

    it('dispatches server/history/saveHistoryNote on save', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const job = createMockJob({ job_id: 'job_123' })
        const wrapper = mount(HistoryListPanelNoteDialog, {
            props: {
                modelValue: true,
                type: 'create',
                job,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // Set note value
        const textarea = wrapper.find('textarea')
        textarea.element.value = 'My note content'
        textarea.trigger('input')

        const saveBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Buttons.Save'))
        if (saveBtn) {
            await saveBtn.trigger('click')
        }

        expect(store.dispatch).toHaveBeenCalledWith('server/history/saveHistoryNote', {
            job_id: 'job_123',
            note: 'My note content',
        })
    })

    it('closes dialog on save', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const job = createMockJob()
        const wrapper = mount(HistoryListPanelNoteDialog, {
            props: {
                modelValue: true,
                type: 'create',
                job,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        const saveBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Buttons.Save'))
        if (saveBtn) {
            await saveBtn.trigger('click')
        }

        const emitted = wrapper.emitted('update:modelValue')
        expect(emitted).toBeTruthy()
        if (emitted) {
            expect(emitted[0]).toEqual([false])
        }
    })

    it('closes dialog on cancel', async () => {
        const store = createStoreWithState()
        const job = createMockJob()
        const wrapper = mount(HistoryListPanelNoteDialog, {
            props: {
                modelValue: true,
                type: 'create',
                job,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        const cancelBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Buttons.Cancel'))
        if (cancelBtn) {
            await cancelBtn.trigger('click')
        }

        const emitted = wrapper.emitted('update:modelValue')
        expect(emitted).toBeTruthy()
        if (emitted) {
            expect(emitted[0]).toEqual([false])
        }
    })
})
