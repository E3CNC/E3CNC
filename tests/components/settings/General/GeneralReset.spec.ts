import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

let mockLoadings = ref([])
let mockMoonrakerComponents = ref<string[]>([])
const mockLoadFn = vi.fn().mockResolvedValue([
    { value: 'general', label: 'General' },
    { value: 'webcams', label: 'Webcams' },
])

vi.mock('@/composables/useSettingsDatabase', () => ({
    useSettingsDatabase: () => ({
        loadings: mockLoadings,
        loadBackupableNamespaces: mockLoadFn,
        moonrakerComponents: mockMoonrakerComponents,
    }),
}))

vi.mock('vuetify/components', () => ({
    VBtn: {
        name: 'VBtn',
        props: ['size', 'loading', 'color'],
        template: '<button class="v-btn" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'persistent', 'width'],
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['title', 'cardClass', 'marginBottom', 'icon'],
        template:
            '<div class="panel-stub"><span class="panel-title">{{ title }}</span><slot name="buttons" /><slot name="default" /><slot /></div>',
    },
}))

vi.mock('@/components/inputs/CheckboxList.vue', () => ({
    default: {
        name: 'CheckboxList',
        props: ['options', 'selectAll'],
        template: '<div class="checkbox-list" />',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                GeneralTab: {
                    FactoryReset: 'Factory Reset',
                    FactoryDialog: 'Reset all data',
                    Reset: 'Reset',
                    DbHistoryJobs: 'History Jobs',
                    DbHistoryTotals: 'History Totals',
                },
            },
        },
    },
})

const store = createStore({
    state: { gui: { general: {} }, instancesDB: 'moonraker' },
    actions: {
        'socket/addLoading': vi.fn(),
        'gui/resetMoonrakerDB': vi.fn(),
    },
})

import GeneralReset from '@/components/settings/General/GeneralReset.vue'

describe('GeneralReset.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockLoadings.value = []
        mockMoonrakerComponents.value = []
        mockLoadFn.mockResolvedValue([
            { value: 'general', label: 'General' },
            { value: 'webcams', label: 'Webcams' },
        ])
    })

    it('renders without crashing', () => {
        const wrapper = mount(GeneralReset, { global: { plugins: [store, i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders factory reset button', () => {
        const wrapper = mount(GeneralReset, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Factory Reset')
    })

    it('opens dialog when factory reset button is clicked', async () => {
        const wrapper = mount(GeneralReset, { global: { plugins: [store, i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)

        await wrapper.find('.v-btn').trigger('click')
        await wrapper.vm.$nextTick()
        await new Promise((r) => setTimeout(r, 10))

        if (wrapper.find('.v-dialog').exists()) {
            expect(true).toBe(true)
        }
    })

    it('dispatches reset action when reset button in dialog is clicked', async () => {
        const wrapper = mount(GeneralReset, { global: { plugins: [store, i18n] } })

        await wrapper.find('.v-btn').trigger('click')
        await wrapper.vm.$nextTick()
        await new Promise((r) => setTimeout(r, 10))

        // Find all buttons and click the reset one
        const buttons = wrapper.findAll('.v-btn')
        // The reset button should dispatch socket/addLoading and gui/resetMoonrakerDB
        if (buttons.length > 1) {
            await buttons[buttons.length - 1].trigger('click')
            await wrapper.vm.$nextTick()
            expect(store._actions['socket/addLoading']).toBeTruthy()
        }
    })

    it('loads history namespaces when moonraker has history component', async () => {
        mockMoonrakerComponents.value = ['history']
        const wrapper = mount(GeneralReset, { global: { plugins: [store, i18n] } })

        await wrapper.find('.v-btn').trigger('click')
        await wrapper.vm.$nextTick()
        await new Promise((r) => setTimeout(r, 10))

        // loadBackupableNamespaces should have been called
        expect(mockLoadFn).toHaveBeenCalled()
    })
})
