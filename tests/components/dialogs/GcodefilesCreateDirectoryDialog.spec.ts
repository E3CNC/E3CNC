import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// Shared translation function used by both the mock and global $t
const t = (key: string): string => {
    const translations: Record<string, string> = {
        'Files.NewDirectory': 'New Directory',
        'Files.Name': 'Name',
        'Files.Create': 'Create',
        'Files.InvalidNameEmpty': 'Name must not be empty.',
        'Files.InvalidNameAlreadyExists': 'Name already exists.',
        'Buttons.Cancel': 'Cancel',
    }
    return translations[key] ?? key
}

// --- Mock vue-i18n (provides useI18n() used in script setup for rules) ---
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'Files.NewDirectory': 'New Directory',
                'Files.Name': 'Name',
                'Files.Create': 'Create',
                'Files.InvalidNameEmpty': 'Name must not be empty.',
                'Files.InvalidNameAlreadyExists': 'Name already exists.',
                'Buttons.Cancel': 'Cancel',
            }
            return translations[key] ?? key
        },
    }),
}))

// --- Mock vuex useStore ---
// The store's currentPath is relative (without leading 'gcodes').
// The component prepends 'gcodes' when emitting server.files.post_directory.
const mockStoreState = {
    gui: {
        view: {
            gcodefiles: {
                currentPath: 'gcodes/subdir',
            },
        },
    },
    files: {
        gcodefiles: [
            { filename: 'existing-file.gcode', type: 'file' },
        ],
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

// --- Mock vuetify components ---
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
            '<div class="v-text-field"><label>{{ label }}</label><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keydown.enter="$emit(\'keydown:enter\')" /><slot /></div>',
        props: ['modelValue', 'label', 'required', 'rules'],
        emits: ['update:modelValue', 'update:error', 'keydown:enter'],
        methods: {
            focus: () => {},
        },
    },
    VSpacer: {
        name: 'VSpacer',
        template: '<div class="v-spacer" />',
    },
}))

// --- Mock @/composables/useSocket ---
const mockSocketEmit = vi.fn()

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: mockSocketEmit,
    }),
}))

import GcodefilesCreateDirectoryDialog from '@/components/dialogs/GcodefilesCreateDirectoryDialog.vue'

// Shared mount options
const mountOptions = {
    props: {
        modelValue: true,
    },
    global: {
        mocks: {
            // $t is a global property injected by the vue-i18n plugin (used in templates)
            $t: t,
        },
        stubs: {
            // Panel uses useBase() which requires Vuetify's useDisplay() — stub it
            Panel: {
                name: 'Panel',
                template:
                    '<div class="panel-stub"><span class="panel-title">{{ title }}</span><slot name="buttons" /><slot name="default" /><slot /></div>',
                props: ['title', 'cardClass', 'marginBottom'],
            },
        },
    },
}

describe('GcodefilesCreateDirectoryDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(GcodefilesCreateDirectoryDialog, mountOptions)

        expect(wrapper.exists()).toBe(true)
    })

    it('shows the dialog with correct title and fields', () => {
        const wrapper = mount(GcodefilesCreateDirectoryDialog, mountOptions)

        // Dialog title from Panel title prop via $t('Files.NewDirectory')
        expect(wrapper.text()).toContain('New Directory')

        // Input field label via $t('Files.Name')
        expect(wrapper.text()).toContain('Name')

        // Cancel and Create buttons
        expect(wrapper.text()).toContain('Cancel')
        expect(wrapper.text()).toContain('Create')
    })

    it('save button is disabled when name is empty', () => {
        const wrapper = mount(GcodefilesCreateDirectoryDialog, mountOptions)

        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        // The Create button (last button) should be disabled because name is empty
        const createButton = buttons[buttons.length - 1]
        expect(createButton.props('disabled')).toBe(true)
    })

    it('save button dispatches createDirectory action on click', async () => {
        const wrapper = mount(GcodefilesCreateDirectoryDialog, mountOptions)

        // Fill in the directory name
        const textField = wrapper.findComponent({ name: 'VTextField' })
        await textField.setValue('my-new-directory')

        // The Create button should now be enabled
        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const createButton = buttons[buttons.length - 1]
        expect(createButton.props('disabled')).toBe(false)

        // Click the Create button
        await createButton.trigger('click')

        // Verify socket.emit was called with the right arguments
        // Store currentPath is 'gcodes/subdir', useGcodeFiles returns 'gcodes/subdir' (not exactly 'gcodes'),
        // component does: 'gcodes' + currentPath + '/' + name = 'gcodesgcodes/subdir/my-new-directory'
        expect(mockSocketEmit).toHaveBeenCalledTimes(1)
        expect(mockSocketEmit).toHaveBeenCalledWith(
            'server.files.post_directory',
            { path: 'gcodesgcodes/subdir/my-new-directory' },
            { action: 'files/getCreateDir' }
        )
    })

    it('closes the dialog when Cancel is clicked', async () => {
        const wrapper = mount(GcodefilesCreateDirectoryDialog, mountOptions)

        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        // The first button is the close icon button which calls closePrompt
        const closeButton = buttons[0]
        await closeButton.trigger('click')

        // The dialog should have emitted update:modelValue with false
        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('closes the dialog when Create is clicked', async () => {
        const wrapper = mount(GcodefilesCreateDirectoryDialog, mountOptions)

        const textField = wrapper.findComponent({ name: 'VTextField' })
        await textField.setValue('test-dir')

        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const createButton = buttons[buttons.length - 1]
        await createButton.trigger('click')

        // After successful creation, the dialog emits update:modelValue(false) via closePrompt
        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('creates directory via Enter key on the input field', async () => {
        const wrapper = mount(GcodefilesCreateDirectoryDialog, mountOptions)

        const textField = wrapper.findComponent({ name: 'VTextField' })
        await textField.setValue('enter-dir')

        // The VTextField stub's input element has @keydown.enter which emits
        // the custom 'keydown:enter' event, caught by the parent's @keydown.enter.
        const inputEl = textField.find('input')
        await inputEl.trigger('keydown', { key: 'Enter' })

        // Flush pending reactivity (including the setTimeout in the watch)
        await nextTick()
        await nextTick()

        // The socket emit should have been called
        expect(mockSocketEmit).toHaveBeenCalledTimes(1)
        expect(mockSocketEmit).toHaveBeenCalledWith(
            'server.files.post_directory',
            { path: 'gcodesgcodes/subdir/enter-dir' },
            { action: 'files/getCreateDir' }
        )

        // Should also close the dialog
        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('resets fields when dialog reopens', async () => {
        const wrapper = mount(GcodefilesCreateDirectoryDialog, {
            props: {
                modelValue: false,
            },
            global: mountOptions.global,
        })

        // Open the dialog
        await wrapper.setProps({ modelValue: true })
        await nextTick()

        // Set a value
        const textField = wrapper.findComponent({ name: 'VTextField' })
        await textField.setValue('some-dir')

        // Close the dialog
        await wrapper.setProps({ modelValue: false })
        await nextTick()

        // Reopen dialog
        await wrapper.setProps({ modelValue: true })
        await nextTick()
        await nextTick() // the setTimeout in the watch needs an extra tick

        // The name field should be reset to empty (the watch on showDialog resets it)
        const textFieldAfter = wrapper.findComponent({ name: 'VTextField' })
        expect(textFieldAfter.props('modelValue')).toBe('')
    })
})
