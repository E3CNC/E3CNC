import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: vi.fn() }),
}))

vi.mock('vuetify/components', () => ({
    VDialog: { name: 'VDialog', template: '<div v-if="modelValue"><slot /></div>', props: ['modelValue', 'maxWidth'] },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
    VBtn: { name: 'VBtn', props: ['disabled', 'variant', 'color', 'icon', 'size', 'type'], template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>' },
    VTextField: { name: 'VTextField', props: ['modelValue', 'label', 'required', 'rules', 'type'], template: '<div class="v-text-field"><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
    VIcon: { name: 'VIcon', props: ['icon'], template: '<i class="v-icon" />' },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['title', 'icon', 'cardClass', 'marginBottom'],
        template: '<div class="panel-stub"><span>{{ title }}</span><slot name="buttons" /><slot name="default" /></div>',
    },
}))

const i18n = createI18n({
    legacy: false, locale: 'en',
    messages: { en: { JobQueue: { ChangeCount: 'Change Count', Count: 'Count' }, Buttons: { Cancel: 'Cancel' } } },
})

const store = createStore({ state: { instancesDB: 'moonraker', gui: {} } })

import JobqueueEntryChangeCountDialog from '@/components/dialogs/JobqueueEntryChangeCountDialog.vue'

describe('JobqueueEntryChangeCountDialog.vue', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders without crashing', () => {
        const wrapper = mount(JobqueueEntryChangeCountDialog, {
            props: { modelValue: true, jobId: '123', count: 1 },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders title', () => {
        const wrapper = mount(JobqueueEntryChangeCountDialog, {
            props: { modelValue: true, jobId: '123', count: 1 },
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Change Count')
    })
})
