import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import StartPrintDialogTimelapse from '@/components/dialogs/StartPrintDialogTimelapse.vue'

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { Dialogs: { StartPrint: { Timelapse: 'Timelapse' } } } },
})

vi.mock('@/composables/useSocket', () => ({ useSocket: () => ({ emit: vi.fn() }) }))

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', props: { class: String }, template: '<div class="v-card-text"><slot /></div>' },
    VSwitch: {
        name: 'VSwitch',
        props: { modelValue: Boolean, hideDetails: Boolean, class: String },
        template:
            '<input type="checkbox" class="v-switch" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    },
    VProgressCircular: {
        name: 'VProgressCircular',
        props: { indeterminate: Boolean, color: String, size: [String, Number] },
        template: '<div class="v-progress-circular" />',
    },
    VRow: { name: 'VRow', props: { class: String }, template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', props: { class: String }, template: '<div class="v-col"><slot /></div>' },
    VIcon: { name: 'VIcon', props: { icon: String }, template: '<i class="v-icon"><slot /></i>' },
}))

vi.mock('@/components/ui/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: { title: String, dense: Boolean },
        template: '<div class="settings-row"><slot /></div>',
    },
}))

function makeStore(enabled = false) {
    return createStore({
        state: { server: { timelapse: { settings: { enabled } } } },
    })
}

describe('StartPrintDialogTimelapse.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('mounts without crashing', () => {
        const wrapper = mount(StartPrintDialogTimelapse, { global: { plugins: [makeStore(), i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the timelapse row label', () => {
        const wrapper = mount(StartPrintDialogTimelapse, { global: { plugins: [makeStore(), i18n] } })
        expect(wrapper.text()).toContain('Timelapse')
    })

    it('switch is unchecked when timelapse is disabled', () => {
        const wrapper = mount(StartPrintDialogTimelapse, { global: { plugins: [makeStore(false), i18n] } })
        const switchInput = wrapper.find('input[type="checkbox"]') as any
        expect(switchInput.element?.checked ?? false).toBe(false)
    })

    it('switch is checked when timelapse is enabled', () => {
        const wrapper = mount(StartPrintDialogTimelapse, { global: { plugins: [makeStore(true), i18n] } })
        const switchInput = wrapper.find('input[type="checkbox"]') as any
        expect(switchInput.element?.checked ?? false).toBe(true)
    })
})
