import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const t = (key: string): string => {
    const translations: Record<string, string> = {
        'Files.AddToQueue': 'Add to Queue',
        'Files.Count': 'Count',
        'History.AddToQueueSuccessful': 'Added {filename} to queue',
        'JobQueue.InvalidCountEmpty': 'Count must not be empty.',
        'JobQueue.InvalidCountGreaterZero': 'Count must be greater than 0.',
        'Buttons.Cancel': 'Cancel',
    }
    return translations[key] ?? key
}

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t }),
}))

const mockStoreDispatch = vi.fn()

vi.mock('vuex', () => ({
    useStore: () => ({
        state: { instancesDB: 'moonraker' },
        dispatch: mockStoreDispatch,
    }),
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        template: '<div class="v-dialog" :value="modelValue"><slot /></div>',
        props: ['modelValue', 'maxWidth'],
        emits: ['click:outside', 'keydown:esc'],
    },
    VCardText: {
        name: 'VCardText',
        template: '<div class="v-card-text"><slot /></div>',
    },
    VCardActions: {
        name: 'VCardActions',
        template: '<div class="v-card-actions"><slot /></div>',
    },
    VBtn: {
        name: 'VBtn',
        props: ['disabled', 'variant', 'color', 'icon', 'size', 'type'],
        template: '<button :disabled="disabled" :type="type" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VTextField: {
        name: 'VTextField',
        props: ['modelValue', 'label', 'required', 'rules', 'type'],
        template:
            '<div class="v-text-field"><label>{{ label }}</label><input :value="modelValue" type="text" @input="$emit(\'update:modelValue\', $event.target.value)" /><slot /></div>',
        emits: ['update:modelValue'],
    },
    VForm: {
        name: 'VForm',
        props: ['modelValue'],
        template: '<form><slot /></form>',
    },
    VSpacer: { name: 'VSpacer', template: '<div class="v-spacer" />' },
    VIcon: { name: 'VIcon', template: '<i><slot /></i>' },
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: vi.fn() }),
}))

import AddBatchToQueueDialog from '@/components/dialogs/AddBatchToQueueDialog.vue'

const mountOptions = {
    props: {
        modelValue: true,
        filename: 'test-file.gcode',
        showToast: false,
    },
    global: {
        mocks: {
            $t: t,
        },
        stubs: {
            Panel: {
                name: 'Panel',
                template:
                    '<div class="panel-stub"><span class="panel-title">{{ title }}</span><slot name="buttons" /><slot name="default" /></div>',
                props: ['title', 'icon', 'cardClass', 'marginBottom'],
            },
        },
    },
}

describe('AddBatchToQueueDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(AddBatchToQueueDialog, mountOptions)
        expect(wrapper.exists()).toBe(true)
    })

    it('shows dialog with correct title and fields', () => {
        const wrapper = mount(AddBatchToQueueDialog, mountOptions)
        expect(wrapper.text()).toContain('Add to Queue')
        expect(wrapper.text()).toContain('Count')
        expect(wrapper.text()).toContain('Cancel')
    })

    it('shows count input field', () => {
        const wrapper = mount(AddBatchToQueueDialog, mountOptions)
        const textField = wrapper.findComponent({ name: 'VTextField' })
        expect(textField.exists()).toBe(true)
        expect(textField.props('label')).toBe('Count')
    })

    it('dispatches addToQueue on submit', async () => {
        mockStoreDispatch.mockResolvedValue(undefined)
        const wrapper = mount(AddBatchToQueueDialog, mountOptions)

        // The component uses @submit.prevent on the form — find the <form> element
        const formEl = wrapper.find('form')
        await formEl.trigger('submit')
        await nextTick()

        expect(mockStoreDispatch).toHaveBeenCalledWith('server/jobQueue/addToQueue', ['test-file.gcode'])
    })

    it('closes dialog on cancel', async () => {
        const wrapper = mount(AddBatchToQueueDialog, mountOptions)
        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const cancelBtn = buttons.filter((b) => b.text() === 'Cancel')
        await cancelBtn[0].trigger('click')
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })
})
