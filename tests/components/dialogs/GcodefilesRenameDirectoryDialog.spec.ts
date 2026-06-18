import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const t = (key: string): string => {
    const translations: Record<string, string> = {
        'Files.RenameDirectory': 'Rename Directory',
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
        gcodefiles: [
            { filename: 'old-dir-name', type: 'directory' },
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

import GcodefilesRenameDirectoryDialog from '@/components/dialogs/GcodefilesRenameDirectoryDialog.vue'

const mountOptions = {
    props: {
        modelValue: true,
        item: { filename: 'old-dir-name', isDirectory: true, modified: 1000, size: 0 },
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

describe('GcodefilesRenameDirectoryDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(GcodefilesRenameDirectoryDialog, mountOptions)
        expect(wrapper.exists()).toBe(true)
    })

    it('shows dialog with correct title and fields', () => {
        const wrapper = mount(GcodefilesRenameDirectoryDialog, mountOptions)
        expect(wrapper.text()).toContain('Rename Directory')
        expect(wrapper.text()).toContain('Name')
        expect(wrapper.text()).toContain('Cancel')
        expect(wrapper.text()).toContain('Rename')
    })

    it('pre-fills input with current directory name after opening', async () => {
        const wrapper = mount(GcodefilesRenameDirectoryDialog, {
            props: { modelValue: false, item: { filename: 'old-dir-name', isDirectory: true, modified: 1000, size: 0 } },
            global: mountOptions.global,
        })
        await wrapper.setProps({ modelValue: true })
        await nextTick()
        const textField = wrapper.findComponent({ name: 'VTextField' })
        expect(textField.props('modelValue')).toBe('old-dir-name')
    })

    it('dispatches server.files.move on rename', async () => {
        const wrapper = mount(GcodefilesRenameDirectoryDialog, {
            props: { modelValue: false, item: { filename: 'old-dir-name', isDirectory: true, modified: 1000, size: 0 } },
            global: mountOptions.global,
        })
        await wrapper.setProps({ modelValue: true })
        await nextTick()
        const inputEl = wrapper.find('input')
        await inputEl.setValue('new-dir-name')

        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const renameBtn = buttons[buttons.length - 1]
        await renameBtn.trigger('click')

        expect(mockSocketEmit).toHaveBeenCalledTimes(1)
        expect(mockSocketEmit).toHaveBeenCalledWith(
            'server.files.move',
            {
                source: 'gcodesgcodes/subdir/old-dir-name',
                dest: 'gcodesgcodes/subdir/new-dir-name',
            },
            { action: 'files/getMove' }
        )
    })

    it('closes dialog on cancel', async () => {
        const wrapper = mount(GcodefilesRenameDirectoryDialog, mountOptions)
        const closeButton = wrapper.findAllComponents({ name: 'VBtn' })[0]
        await closeButton.trigger('click')
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })
})
