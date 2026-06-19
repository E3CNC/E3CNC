import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const t = (key: string): string => {
    const translations: Record<string, string> = {
        'Files.RenameFile': 'Rename File',
        'Files.Name': 'Name',
        'Files.Rename': 'Rename',
        'Files.InvalidNameEmpty': 'Name must not be empty.',
        'Files.InvalidNameAlreadyExists': 'Name already exists.',
        'Buttons.Cancel': 'Cancel',
    }
    return translations[key] ?? key
}

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t }),
}))

const mockStoreState = {
    gui: {
        view: {
            gcodefiles: { currentPath: 'gcodes/subdir' },
        },
    },
    files: {
        gcodefiles: [{ filename: 'existing-file.gcode', type: 'file' }],
    },
}

vi.mock('vuex', () => ({
    useStore: () => ({
        state: mockStoreState,
        dispatch: vi.fn(),
        getters: {
            'files/getGcodeFiles': () => mockStoreState.files.gcodefiles,
        },
    }),
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        template: '<div class="v-dialog"><slot /></div>',
        props: ['modelValue'],
    },
    VBtn: {
        name: 'VBtn',
        template:
            '<button :class="[\'v-btn\', { \'v-btn--disabled\': disabled }]" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
        props: ['disabled', 'variant', 'color', 'icon', 'rounded'],
        emits: ['click'],
    },
    VCardText: {
        name: 'VCardText',
        template: '<div class="v-card-text"><slot /></div>',
    },
    VCardActions: {
        name: 'VCardActions',
        template: '<div class="v-card-actions"><slot /></div>',
    },
    VTextField: {
        name: 'VTextField',
        template:
            '<div class="v-text-field"><label>{{ label }}</label><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'update:error\', false)" @keydown.enter="$emit(\'keydown:enter\')" /><slot /></div>',
        props: ['modelValue', 'label', 'required', 'rules'],
        emits: ['update:modelValue', 'update:error', 'keydown:enter'],
        methods: { focus: () => {} },
    },
    VSpacer: {
        name: 'VSpacer',
        template: '<div class="v-spacer" />',
    },
}))

const mockSocketEmit = vi.fn()

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mockSocketEmit }),
}))

import GcodefilesRenameFileDialog from '@/components/dialogs/GcodefilesRenameFileDialog.vue'

const sampleFile = {
    filename: 'test-file.gcode',
    modified: 1000,
    size: 1024,
}

const mountOptions = {
    props: {
        modelValue: true,
        item: sampleFile,
    },
    global: {
        mocks: { $t: t },
        stubs: {
            Panel: {
                name: 'Panel',
                template:
                    '<div class="panel-stub"><span class="panel-title">{{ title }}</span><slot name="buttons" /><slot name="default" /></div>',
                props: ['title', 'cardClass', 'marginBottom'],
            },
        },
    },
}

describe('GcodefilesRenameFileDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(GcodefilesRenameFileDialog, mountOptions as any)
        expect(wrapper.exists()).toBe(true)
    })

    it('shows the dialog with correct title and fields', () => {
        const wrapper = mount(GcodefilesRenameFileDialog, mountOptions as any)
        expect(wrapper.text()).toContain('Rename File')
        expect(wrapper.text()).toContain('Name')
        expect(wrapper.text()).toContain('Cancel')
        expect(wrapper.text()).toContain('Rename')
    })

    it('pre-fills the input field with the current filename after opening', async () => {
        // Mount closed, then open to trigger the watch that pre-fills the name
        const wrapper = mount(GcodefilesRenameFileDialog, {
            props: { modelValue: false, item: sampleFile },
            global: mountOptions.global,
        } as any)
        await wrapper.setProps({ modelValue: true })
        await nextTick()
        const textField = wrapper.findComponent({ name: 'VTextField' })
        expect(textField.props('modelValue')).toBe('test-file.gcode')
    })

    it('rename button is disabled when name is unchanged (isInvalidName starts true)', async () => {
        // Mount with modelValue false first, then open
        const wrapper = mount(GcodefilesRenameFileDialog, {
            props: { modelValue: false, item: sampleFile },
            global: mountOptions.global,
        } as any)
        await wrapper.setProps({ modelValue: true })
        await nextTick()
        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const renameButton = buttons[buttons.length - 1]
        // Button is disabled because isInvalidName starts true (pre-filled value unchanged)
        expect(renameButton.props('disabled')).toBe(true)
    })

    it('dispatches server.files.move on rename', async () => {
        // Mount closed first so watcher fires on open
        const wrapper = mount(GcodefilesRenameFileDialog, {
            props: { modelValue: false, item: sampleFile },
            global: mountOptions.global,
        } as any)
        await wrapper.setProps({ modelValue: true })
        await nextTick()

        // Trigger the input event on the native <input> element to update name and emit update:error
        const inputEl = wrapper.find('input')
        await inputEl.setValue('renamed-file.gcode')

        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const renameButton = buttons[buttons.length - 1]
        expect(renameButton.exists()).toBe(true)
        // Directly trigger click on the rename button
        await renameButton.trigger('click')

        expect(mockSocketEmit).toHaveBeenCalledTimes(1)
        expect(mockSocketEmit).toHaveBeenCalledWith(
            'server.files.move',
            {
                source: 'gcodesgcodes/subdir/test-file.gcode',
                dest: 'gcodesgcodes/subdir/renamed-file.gcode',
            },
            { action: 'files/getMove' }
        )
    })

    it('closes the dialog on cancel', async () => {
        const wrapper = mount(GcodefilesRenameFileDialog, mountOptions as any)

        const closeButton = wrapper.findAllComponents({ name: 'VBtn' })[0]
        await closeButton.trigger('click')

        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })
})
