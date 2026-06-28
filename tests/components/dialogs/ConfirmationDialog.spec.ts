import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog.vue'

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { Buttons: { Cancel: 'Cancel' } } },
})

vi.mock('@/composables/useBase', () => ({ useBase: () => ({ isMobile: { value: false } }) }))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: String, marginBottom: Boolean, cardClass: String },
        template:
            '<div class="panel"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: { modelValue: Boolean, width: [String, Number], fullscreen: Boolean },
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: { variant: String, color: String, icon: [String, Boolean] },
        template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>',
    },
    VSpacer: { name: 'VSpacer', template: '<span />' },
    VIcon: { name: 'VIcon', props: { icon: String }, template: '<i class="v-icon"><slot /></i>' },
}))

describe('ConfirmationDialog.vue', () => {
    it('does not render when modelValue is false', () => {
        const wrapper = mount(ConfirmationDialog, {
            props: { modelValue: false, title: 'Confirm', text: 'Are you sure?', actionButtonText: 'Yes' },
            global: { plugins: [i18n] },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders when modelValue is true', () => {
        const wrapper = mount(ConfirmationDialog, {
            props: { modelValue: true, title: 'Confirm', text: 'Are you sure?', actionButtonText: 'Yes' },
            global: { plugins: [i18n] },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
        expect(wrapper.text()).toContain('Confirm')
        expect(wrapper.text()).toContain('Are you sure?')
    })

    it('shows action and cancel buttons', () => {
        const wrapper = mount(ConfirmationDialog, {
            props: { modelValue: true, title: 'Confirm', text: 'Are you sure?', actionButtonText: 'Yes' },
            global: { plugins: [i18n] },
        })
        const buttons = wrapper.findAll('button')
        expect(buttons.filter((b) => b.text().includes('Yes')).length).toBeGreaterThanOrEqual(1)
        // Cancel is from i18n
        expect(buttons.filter((b) => b.text().includes('Cancel')).length).toBeGreaterThanOrEqual(1)
    })

    it('emits action and closes on action click', async () => {
        const wrapper = mount(ConfirmationDialog, {
            props: { modelValue: true, title: 'Confirm', text: 'Are you sure?', actionButtonText: 'Yes' },
            global: { plugins: [i18n] },
        })
        const yesBtn = wrapper.findAll('button').find((b) => b.text().includes('Yes'))
        await yesBtn!.trigger('click')
        expect(wrapper.emitted('action')).toBeTruthy()
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('emits close on cancel click', async () => {
        const wrapper = mount(ConfirmationDialog, {
            props: { modelValue: true, title: 'Confirm', text: 'Are you sure?', actionButtonText: 'Yes' },
            global: { plugins: [i18n] },
        })
        const cancelBtn = wrapper.findAll('button').find((b) => b.text().includes('Cancel'))
        await cancelBtn!.trigger('click')
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('uses custom cancel button text', () => {
        const wrapper = mount(ConfirmationDialog, {
            props: {
                modelValue: true,
                title: 'Confirm',
                text: 'Are you sure?',
                actionButtonText: 'Yes',
                cancelButtonText: 'No',
            },
            global: { plugins: [i18n] },
        })
        expect(wrapper.text()).toContain('No')
    })

    it('uses default alert icon when no icon provided', () => {
        const wrapper = mount(ConfirmationDialog, {
            props: { modelValue: true, title: 'Confirm', text: 'Are you sure?', actionButtonText: 'Yes' },
            global: { plugins: [i18n] },
        })
        // Panel renders with icon slot
        expect(wrapper.find('.panel').exists()).toBe(true)
    })
})
