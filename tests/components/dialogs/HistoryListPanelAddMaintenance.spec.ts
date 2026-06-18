import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import HistoryListPanelAddMaintenance from '@/components/dialogs/HistoryListPanelAddMaintenance.vue'

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
        props: ['modelValue', 'items', 'variant', 'density', 'hideDetails'],
        template:
            '<select :value="modelValue"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.text }}</option></select>',
    },
    VCheckbox: {
        name: 'VCheckbox',
        props: ['modelValue', 'hideDetails'],
        template:
            '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
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

describe('HistoryListPanelAddMaintenance.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders when modelValue is true', () => {
        const store = createStoreWithState()
        const wrapper = mount(HistoryListPanelAddMaintenance, {
            props: {
                modelValue: true,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('.history-add-maintenance-dialog').exists()).toBe(true)
    })

    it('does not render when modelValue is false', () => {
        const store = createStoreWithState()
        const wrapper = mount(HistoryListPanelAddMaintenance, {
            props: {
                modelValue: false,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.find('.history-add-maintenance-dialog').exists()).toBe(false)
    })

    it('renders name text field', () => {
        const store = createStoreWithState()
        const wrapper = mount(HistoryListPanelAddMaintenance, {
            props: {
                modelValue: true,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        expect(wrapper.text()).toContain('History.Name')
    })

    it('save button is disabled when name is empty', () => {
        const store = createStoreWithState()
        const wrapper = mount(HistoryListPanelAddMaintenance, {
            props: {
                modelValue: true,
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

    it('save button is enabled when name is filled and no reminder set', async () => {
        const store = createStoreWithState()
        const wrapper = mount(HistoryListPanelAddMaintenance, {
            props: {
                modelValue: true,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        const nameInput = wrapper.find('input')
        await nameInput.setValue('My Maintenance')

        const saveBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Buttons.Save'))
        // With name set and no reminder selected, isValid should be true
        expect(saveBtn?.attributes('disabled')).toBeUndefined()
    })

    it('resets values when dialog opens', async () => {
        const store = createStoreWithState()
        const wrapper = mount(HistoryListPanelAddMaintenance, {
            props: {
                modelValue: true,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // Set some values while dialog is open
        const nameInput = wrapper.find('input')
        await nameInput.setValue('Test')

        // Close and reopen dialog - should reset values
        await wrapper.setProps({ modelValue: false })
        await wrapper.setProps({ modelValue: true })

        // After reset, name should be empty and save disabled
        const saveBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Buttons.Save'))
        expect(saveBtn?.attributes('disabled')).toBeDefined()
    })

    it('dispatches gui/maintenance/store on save', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const wrapper = mount(HistoryListPanelAddMaintenance, {
            props: {
                modelValue: true,
            },
            global: {
                plugins: [store],
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        const nameInput = wrapper.find('input')
        await nameInput.setValue('My Maintenance')

        const saveBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Buttons.Save'))
        if (saveBtn) {
            await saveBtn.trigger('click')
        }

        expect(store.dispatch).toHaveBeenCalledWith('gui/maintenance/store', expect.any(Object))
    })

    it('renders reminder select options', () => {
        const store = createStoreWithState()
        const wrapper = mount(HistoryListPanelAddMaintenance, {
            props: {
                modelValue: true,
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

    it('closes dialog on cancel button click', async () => {
        const store = createStoreWithState()
        const wrapper = mount(HistoryListPanelAddMaintenance, {
            props: {
                modelValue: true,
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
})
