import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useSettingsDatabase', () => ({
    useSettingsDatabase: () => ({
        loadings: ref([]),
        loadRestoreableNamespaces: vi.fn(),
        restoreMainsail: vi.fn(),
    }),
}))

vi.mock('vuetify/components', () => ({
    VBtn: {
        name: 'VBtn',
        props: ['size', 'loading', 'color'],
        template: '<button @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'persistent', 'width'],
        template: '<div class="v-dialog"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
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
    messages: { en: { Settings: { GeneralTab: { Restore: 'Restore', RestoreDialog: 'Restore your data' } } } },
})

const store = createStore({ state: { gui: { general: {} }, instancesDB: 'moonraker' } })

import GeneralRestore from '@/components/settings/General/GeneralRestore.vue'

describe('GeneralRestore.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(GeneralRestore, { global: { plugins: [store, i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders restore button', () => {
        const wrapper = mount(GeneralRestore, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Restore')
    })
})
