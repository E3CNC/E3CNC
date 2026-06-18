import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import HistoryListPanelEditMaintenance from '@/components/dialogs/HistoryListPanelEditMaintenance.vue'

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
    VTextField: {
        name: 'VTextField',
        props: ['modelValue', 'rules', 'label', 'hideDetails', 'variant', 'dense'],
        template: '<div><label v-if="label">{{ label }}</label><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>',
    },
    VTextarea: {
        name: 'VTextarea',
        props: ['modelValue', 'label', 'hideDetails', 'variant'],
        template:
            '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
    },
    VSelect: {
        name: 'VSelect',
        props: ['modelValue', 'items', 'variant', 'density', 'hideDetails', 'disabled'],
        template:
            '<select :value="modelValue" :disabled="disabled"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.text }}</option></select>',
    },
    VCheckbox: {
        name: 'VCheckbox',
        props: ['modelValue', 'hideDetails', 'disabled'],
        template:
            '<input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'rounded', 'color', 'variant', 'disabled'],
        template: '<button :disabled="disabled"><slot /></button>',
    },
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

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: ['icon', 'title', 'subTitle'],
        template: '<div class="settings-row"><div v-if="title">{{ title }}</div><div v-if="subTitle">{{ subTitle }}</div><slot /></div>',
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
                history: {
                    job_totals: {
                        total_filament_used: 50000,
                        total_print_time: 7200,
                    },
                },
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

function createMockItem(overrides: Record<string, any> = {}) {
    return {
        id: 'entry_1',
        name: 'Oil Change',
        note: 'Engine oil',
        start_time: 1000000,
        end_time: null,
        start_filament: 0,
        end_filament: null,
        start_printtime: 0,
        end_printtime: null,
        last_entry: null,
        reminder: {
            type: 'one-time',
            filament: { bool: true, value: 1000 },
            printtime: { bool: false, value: null },
            date: { bool: false, value: null },
        },
        ...overrides,
    }
}

describe('HistoryListPanelEditMaintenance.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders when modelValue is true', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelEditMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('.history-edit-maintenance-dialog').exists()).toBe(true)
    })

    it('does not render when modelValue is false', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelEditMaintenance, {
            props: {
                modelValue: false,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('.history-edit-maintenance-dialog').exists()).toBe(false)
    })

    it('pre-fills form fields from item prop', () => {
        const store = createStoreWithState()
        const item = createMockItem({
            name: 'Fan Cleaning',
            note: 'Clean the fan blades',
            reminder: {
                type: 'repeat',
                filament: { bool: true, value: 500 },
                printtime: { bool: true, value: 100 },
                date: { bool: false, value: null },
            },
        })

        const wrapper = mount(HistoryListPanelEditMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // The name and note fields should be pre-filled from the item
        const nameInput = wrapper.find('input')
        expect(nameInput.element.value).toBe('Fan Cleaning')
    })

    it('save button is disabled when name is empty', () => {
        const store = createStoreWithState()
        const item = createMockItem({ name: '' })
        const wrapper = mount(HistoryListPanelEditMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        const saveBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Buttons.Save'))
        expect(saveBtn?.attributes('disabled')).toBeDefined()
    })

    it('dispatches gui/maintenance/update on save', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const item = createMockItem({
            name: 'Lubrication',
            note: 'Applied grease',
        })
        const wrapper = mount(HistoryListPanelEditMaintenance, {
            props: {
                modelValue: true,
                item,
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

        expect(store.dispatch).toHaveBeenCalledWith('gui/maintenance/update', expect.any(Object))
    })

    it('closes dialog on cancel', async () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelEditMaintenance, {
            props: {
                modelValue: true,
                item,
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

        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        if (wrapper.emitted('update:modelValue')) {
            expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
        }
    })

    it('renders reminder select with options', () => {
        const store = createStoreWithState()
        const item = createMockItem()
        const wrapper = mount(HistoryListPanelEditMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.Reminder')
        expect(wrapper.text()).toContain('History.NoReminder')
        expect(wrapper.text()).toContain('History.OneTime')
        expect(wrapper.text()).toContain('History.Repeat')
    })

    it('disables reminder inputs when item has end_time', () => {
        const store = createStoreWithState()
        const item = createMockItem({ end_time: 1005000 })
        const wrapper = mount(HistoryListPanelEditMaintenance, {
            props: {
                modelValue: true,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // The VSelect should be disabled when end_time is not null
        const selects = wrapper.findAll('select')
        selects.forEach((select) => {
            expect(select.attributes('disabled')).toBeDefined()
        })
    })

    it('resets form fields when dialog opens', async () => {
        const store = createStoreWithState()
        const item = createMockItem({
            name: 'Initial Name',
            note: 'Initial note',
        })

        const wrapper = mount(HistoryListPanelEditMaintenance, {
            props: {
                modelValue: false,
                item,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // Open dialog - watch should populate fields
        await wrapper.setProps({ modelValue: true })

        const nameInput = wrapper.find('input')
        expect(nameInput.element.value).toBe('Initial Name')
    })
})
