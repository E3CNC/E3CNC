import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SettingsMiscellaneousTabLightGroupsForm from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroupsForm.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vuetify/components', () => ({
    VForm: { name: 'VForm', props: ['modelValue'], template: '<div class="v-form"><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VTextField: {
        name: 'VTextField',
        props: ['modelValue', 'hideDetails', 'rules', 'density', 'variant', 'type', 'step'],
        template: '<input class="v-text-field" />',
    },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<div class="v-spacer" />' },
    VBtn: {
        name: 'VBtn',
        props: ['variant', 'color', 'disabled'],
        template: '<button class="v-btn" :disabled="disabled" @click="$emit(`click`, $event)"><slot /></button>',
    },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: ['title', 'subTitle', 'icon', 'loading'],
        template: '<div class="settings-row"><span class="settings-row-title">{{ title }}</span><slot /></div>',
    },
}))

vi.mock('@/plugins/helpers', () => ({
    caseInsensitiveSort: (arr: any[], key: string) =>
        [...arr].sort((a: any, b: any) =>
            String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { sensitivity: 'base' })
        ),
}))

function createMockStore(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            printer: {
                configfile: {
                    settings: {
                        'neopixel my_strip': {
                            chain_count: 10,
                            ...(overrides.configfile ?? {}),
                        },
                    },
                },
            },
            gui: {
                miscellaneous: {
                    entries: overrides.entries ?? {},
                },
            },
        },
        getters: {},
    })
}

describe('SettingsMiscellaneousTabLightGroupsForm.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders create title when no groupId', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.MiscellaneousTab.CreateGroup')
    })

    it('renders edit title when groupId is provided', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsForm, {
            props: { type: 'neopixel', name: 'my_strip', groupId: 'group-1' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.MiscellaneousTab.EditGroup')
    })

    it('renders cancel and store buttons', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAll('.v-btn')
        expect(buttons.length).toBeGreaterThanOrEqual(2)
    })

    it('emits close on cancel button click', async () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const cancelBtn = wrapper.findAll('.v-btn')[0]
        await cancelBtn.trigger('click')
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('renders store button', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsForm, {
            props: { type: 'neopixel', name: 'my_strip' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAll('.v-btn')
        // Cancel button + Store button (when no groupId)
        expect(buttons.length).toBe(2)
    })

    it('renders update button when groupId is provided', () => {
        const wrapper = mount(SettingsMiscellaneousTabLightGroupsForm, {
            props: { type: 'neopixel', name: 'my_strip', groupId: 'group-1' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Settings.Update')
    })
})
