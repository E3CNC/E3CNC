import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({
        draggableBgStyle: {},
    }),
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: { title: { default: '' }, subTitle: { default: '' } },
        template:
            '<div class="settings-row"><div class="settings-row__title">{{ title }}</div><div class="settings-row__sub">{{ subTitle }}</div><slot /></div>',
    },
}))

const mockKlipperReadyForGui = ref(true)
const mockPrinterState = ref('standby')

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperReadyForGui: mockKlipperReadyForGui,
        printer_state: mockPrinterState,
    }),
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                MacrosTab: {
                    Macrogroups: 'Macrogroups',
                    AvailableMacros: 'Available Macros',
                    Search: 'Search',
                    Add: 'Add',
                    AddGroup: 'Add Group',
                    EditGroup: 'Edit Group',
                    Name: 'Name',
                    Color: 'Color',
                    Status: 'Status',
                    GroupMacros: 'Group Macros',
                    Primary: 'Primary',
                    Secondary: 'Secondary',
                    Success: 'Success',
                    Warning: 'Warning',
                    Error: 'Error',
                    Custom: 'Custom',
                    NoAvailableMacros: 'No available macros',
                    NoGroups: 'No groups',
                    DeletedMacro: 'Deleted macro',
                },
            },
        },
        Buttons: {
            Close: 'Close',
        },
    },
})

vi.mock('vuedraggable', () => ({
    default: {
        name: 'Draggable',
        template: '<div class="draggable"><slot /></div>',
    },
}))

import SettingsMacrosTabExpert from '@/components/settings/SettingsMacrosTabExpert.vue'

function createStoreInstance(macros: Array<{ name: string; description?: string }> = []) {
    const macrogroup = {
        id: 'group-1',
        name: 'Example',
        color: 'primary',
        showInStandby: true,
        showInPause: true,
        showInPrinting: true,
        macros: [],
    }

    return createStore({
        state: {
            gui: {
                macros: { mode: 'expert', hiddenMacros: [], macrogroups: {} },
            },
        },
        getters: {
            'printer/getMacros': () => macros,
            'gui/macros/getAllMacrogroups': () => [],
            'gui/macros/getMacrogroup': () => (id: string | null) => (id === macrogroup.id ? macrogroup : null),
        },
        actions: {
            'gui/macros/groupStore': vi.fn().mockResolvedValue('group-1'),
        },
    })
}

describe('SettingsMacrosTabExpert.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKlipperReadyForGui.value = true
        mockPrinterState.value = 'standby'
    })

    it('groups available macros by related items', async () => {
        const store = createStoreInstance([
            { name: 'BACK_CENTER', description: 'center the back area' },
            { name: 'BACK_LEFT', description: 'left side' },
            { name: 'HOME_X', description: 'home X axis' },
            { name: 'HOME_Y', description: 'home Y axis' },
            { name: 'M104', description: 'set temperature' },
            { name: 'M106', description: 'fan on' },
        ])

        const wrapper = mount(SettingsMacrosTabExpert, {
            global: {
                plugins: [store, i18n],
                stubs: {
                    VCardText: { template: '<div class="v-card-text"><slot /></div>' },
                    VCardActions: { template: '<div class="v-card-actions"><slot /></div>' },
                    VRow: { template: '<div class="v-row"><slot /></div>' },
                    VCol: { template: '<div class="v-col"><slot /></div>' },
                    VBtn: { template: '<button class="v-btn"><slot /></button>' },
                    VDivider: { template: '<hr class="v-divider" />' },
                    VTextField: { template: '<input class="v-text-field" />' },
                    VSelect: { template: '<select class="v-select" />' },
                    VTooltip: {
                        template: '<div class="v-tooltip"><slot name="activator" :props="{}" /><slot /></div>',
                    },
                    VMenu: { template: '<div class="v-menu"><slot name="activator" :props="{}" /><slot /></div>' },
                    VColorPicker: { template: '<div class="v-color-picker" />' },
                    VIcon: { template: '<i><slot /></i>' },
                },
            },
        })

        await wrapper.find('button.v-btn').trigger('click')
        await Promise.resolve()

        expect(wrapper.text()).toContain('Available Macros')
        expect(wrapper.text()).toContain('BACK')
        expect(wrapper.text()).toContain('HOME')
        expect(wrapper.text()).toContain('M-Codes')
        expect(wrapper.text()).toContain('BACK_CENTER')
        expect(wrapper.text()).toContain('HOME_X')
        expect(wrapper.text()).toContain('M104')
    })
})
