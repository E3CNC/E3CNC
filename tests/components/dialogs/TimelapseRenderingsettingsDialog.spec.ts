import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: vi.fn() }),
}))

vi.mock('@/composables/useTimelapse', () => ({
    useTimelapse: () => ({
        timelapseSettings: ref({}),
    }),
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'maxWidth', 'maxHeight'],
        template: '<div v-if="modelValue"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VSelect: {
        name: 'VSelect',
        props: ['modelValue', 'label', 'items'],
        template: '<select class="v-select" :value="modelValue" />',
    },
    VTextField: {
        name: 'VTextField',
        props: ['modelValue', 'label', 'type'],
        template: '<input class="v-text-field" :value="modelValue" />',
    },
    VBtn: {
        name: 'VBtn',
        props: ['color', 'disabled'],
        template: '<button @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', template: '<i><slot /></i>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['title', 'icon', 'cardClass', 'marginBottom'],
        template:
            '<div class="panel-stub"><span>{{ title }}</span><slot name="buttons" /><slot name="default" /></div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Timelapse: {
                RenderSettings: 'Render Settings',
                Type: 'Type',
                MinFramerate: 'Min Framerate',
                MaxFramerate: 'Max Framerate',
                Targetlength: 'Target Length',
                Framerate: 'Framerate',
            },
        },
    },
})

const store = createStore({
    state: { instancesDB: 'moonraker', gui: { timelapse: {} } },
})

import TimelapseRenderingsettingsDialog from '@/components/dialogs/TimelapseRenderingsettingsDialog.vue'

describe('TimelapseRenderingsettingsDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(TimelapseRenderingsettingsDialog, {
            props: { modelValue: true, settings: {} },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders title when dialog is open', () => {
        const wrapper = mount(TimelapseRenderingsettingsDialog, {
            props: { modelValue: true, settings: {} },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Render Settings')
    })

    it('does not render when dialog is closed', () => {
        const wrapper = mount(TimelapseRenderingsettingsDialog, {
            props: { modelValue: false, settings: {} },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).not.toContain('Render Settings')
    })
})
