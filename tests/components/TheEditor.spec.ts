import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import TheEditor from '@/components/TheEditor.vue'
import { getDefaultState as getDefaultEditorState } from '@/store/editor'

// ── Hoisted mocks ──────────────────────────────────────────

const mockRouterReplace = vi.hoisted(() => vi.fn())
const mockRouteReactive = vi.hoisted(() => ({
    path: '/',
    query: {},
    hash: '',
    params: {},
    fullPath: '/',
    meta: {},
}))

const mockIsMobile = vi.hoisted(() => {
    class MockRef {
        _value: any
        __v_isRef = true
        constructor(v: any) { this._value = v }
        get value() { return this._value }
        set value(v) { this._value = v }
    }
    return new MockRef(false)
})

// ── Module-level mocks ─────────────────────────────────────

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vue-router', () => ({
    useRoute: () => mockRouteReactive,
    useRouter: () => ({ replace: mockRouterReplace }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        printer_state: 'ready',
        klipperAppName: 'Klipper',
        isMobile: mockIsMobile,
    }),
}))

vi.mock('@/plugins/helpers', () => ({
    capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
    formatFilesize: (bytes: number) => `${bytes} B`,
    windowBeforeUnloadFunction: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    $toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

vi.mock('@/utils/cfgValidator', () => ({
    validateCfg: vi.fn().mockResolvedValue([]),
}))

vi.mock('@mdi/js', () => ({
    mdiAlert: 'MdiAlert',
    mdiAlertCircle: 'MdiAlertCircle',
    mdiClose: 'MdiClose',
    mdiCloseCircle: 'MdiCloseCircle',
    mdiCloseThick: 'MdiCloseThick',
    mdiContentSave: 'MdiContentSave',
    mdiFileDocumentOutline: 'MdiFileDocumentOutline',
    mdiFileDocumentEditOutline: 'MdiFileDocumentEditOutline',
    mdiHelp: 'MdiHelp',
    mdiHelpCircle: 'MdiHelpCircle',
    mdiRestart: 'MdiRestart',
    mdiUsb: 'MdiUsb',
    mdiFormatListCheckbox: 'MdiFormatListCheckbox',
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'persistent', 'fullscreen', 'width', 'scrollable'],
        template: '<div class="v-dialog" :style="{ display: modelValue ? \'block\' : \'none\' }"><slot /></div>',
    },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'variant', 'rounded', 'color', 'href', 'target'],
        template: '<button class="v-btn" @click="typeof $attrs?.onClick === \'function\' && $attrs.onClick($event); typeof $attrs?.onclick === \'function\' && $attrs.onclick($event)"><slot /><i v-if="icon" class="v-btn-icon">{{ icon }}</i></button>',
    },
    VIcon: {
        name: 'VIcon',
        props: ['icon', 'size'],
        template: '<i class="v-icon"><slot />{{ icon }}</i>',
    },
    VCardText: {
        name: 'VCardText',
        props: ['class'],
        template: '<div class="v-card-text"><slot /></div>',
    },
    VCardActions: {
        name: 'VCardActions',
        template: '<div class="v-card-actions"><slot /></div>',
    },
    VSpacer: {
        name: 'VSpacer',
        template: '<div class="v-spacer" />',
    },
    VSelect: {
        name: 'VSelect',
        props: ['modelValue', 'items', 'density', 'variant', 'hideDetails', 'style'],
        template: '<select class="v-select" :value="modelValue"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
    },
    VTreeview: {
        name: 'VTreeview',
        props: ['activatable', 'density', 'active', 'open', 'itemKey', 'items', 'class'],
        template: '<div class="v-treeview"><slot name="title" :item="{}" /><slot name="append" :item="{}" /></div>',
    },
    VSnackbar: {
        name: 'VSnackbar',
        props: ['modelValue', 'timeout', 'location'],
        template: '<div class="v-snackbar" v-if="modelValue"><slot /><slot name="actions" :props=\'{}\' /></div>',
    },
    VProgressLinear: {
        name: 'VProgressLinear',
        props: ['modelValue', 'indeterminate', 'class'],
        template: '<div class="v-progress-linear" />',
    },
    VRow: {
        name: 'VRow',
        template: '<div class="v-row"><slot /></div>',
    },
    VCol: {
        name: 'VCol',
        props: ['class'],
        template: '<div class="v-col"><slot /></div>',
    },
    VCard: {
        name: 'VCard',
        template: '<div class="v-card"><slot /></div>',
    },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: {
            icon: [String, Object],
            title: [String, Object],
            cardClass: String,
            height: [String, Number],
            marginBottom: Boolean,
        },
        template: '<div class="panel" :class="cardClass" :style="{ height }"><slot name="buttons" /><slot /><span class="panel-title">{{ typeof title === \'string\' ? title : \'\' }}</span></div>',
    },
}))

vi.mock('@/components/inputs/CodemirrorAsync.vue', () => ({
    default: {
        name: 'CodemirrorAsync',
        props: ['modelValue', 'name', 'fileExtension', 'validationErrors', 'class'],
        template: '<div class="codemirror-async-stub" :class="class">CodeMirror Stub</div>',
        emits: ['line-change'],
    },
}))

vi.mock('@/components/dialogs/DevicesDialog.vue', () => ({
    default: {
        name: 'DevicesDialog',
        props: ['modelValue'],
        template: '<div class="devices-dialog-stub">DevicesDialog</div>',
        emits: ['update:modelValue'],
    },
}))

// ── Tests ──────────────────────────────────────────────────

describe('TheEditor.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        mockRouterReplace.mockReset()
        mockRouteReactive.query = {}
        mockRouteReactive.path = '/'
        mockIsMobile.value = false

        const editorState = getDefaultEditorState()
        store = createStore({
            modules: {
                editor: {
                    namespaced: true,
                    state: { ...editorState },
                    actions: {
                        updateSourcecode: vi.fn(),
                        close: vi.fn(),
                        openFile: vi.fn().mockResolvedValue(undefined),
                        saveFile: vi.fn().mockResolvedValue(true),
                        cancelLoad: vi.fn(),
                    },
                },
                gui: {
                    namespaced: true,
                    state: {
                        editor: {
                            escToClose: true,
                            confirmUnsavedChanges: true,
                            klipperRestartMethod: 'FIRMWARE_RESTART',
                            tabSize: 2,
                            fileStructureSidebar: true,
                        },
                        general: {
                            language: 'en',
                        },
                    },
                    actions: {
                        saveSetting: vi.fn(),
                    },
                },
                server: {
                    namespaced: true,
                    state: {
                        system_info: {
                            available_services: [],
                        },
                    },
                },
                printer: {
                    namespaced: true,
                    state: {
                        app_name: 'Klipper',
                        print_stats: { state: 'standby' },
                        idle_timeout: { state: 'Idle' },
                    },
                },
            },
        })
    })

    it('renders without crashing', () => {
        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('does not render the dialog when editor is closed', () => {
        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders the dialog when editor is open', () => {
        store.state.editor.bool = true
        store.state.editor.filename = 'test.cfg'
        store.state.editor.sourcecode = 'some gcode'
        store.state.editor.permissions = 'rw'

        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })

        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('renders the panel with the filename in the title', () => {
        store.state.editor.bool = true
        store.state.editor.filename = 'printer.cfg'
        store.state.editor.filepath = 'config'
        store.state.editor.permissions = 'rw'

        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })

        expect(wrapper.find('.panel').exists()).toBe(true)
        expect(wrapper.find('.panel-title').text()).toContain('config/printer.cfg')
    })

    it('renders the CodemirrorAsync component when editor is open', () => {
        store.state.editor.bool = true
        store.state.editor.filename = 'test.cfg'
        store.state.editor.sourcecode = 'some gcode'
        store.state.editor.permissions = 'rw'

        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })

        expect(wrapper.find('.codemirror-async-stub').exists()).toBe(true)
    })

    it('renders "Read Only" indicator when not writeable', () => {
        store.state.editor.bool = true
        store.state.editor.filename = 'readonly.cfg'
        store.state.editor.permissions = 'r'

        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })

        expect(wrapper.find('.panel-title').text()).toContain('Editor.FileReadOnly')
    })

    it('renders buttons in the toolbar', () => {
        store.state.editor.bool = true
        store.state.editor.filename = 'test.cfg'
        store.state.editor.sourcecode = 'content'
        store.state.editor.permissions = 'rw'

        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })

        const buttons = wrapper.findAll('.v-btn')
        expect(buttons.length).toBeGreaterThan(0)
    })

    it('renders the devices dialog stub', () => {
        store.state.editor.bool = true
        store.state.editor.filename = 'test.cfg'
        store.state.editor.sourcecode = 'content'
        store.state.editor.permissions = 'rw'

        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })

        // DevicesDialog should be rendered as a child
        expect(wrapper.find('.devices-dialog-stub').exists()).toBe(true)
    })

    it('restores editor file from query on mount', async () => {
        mockRouteReactive.query = { editorFile: 'config/printer.cfg' }
        store.state.editor.bool = false

        const openFileSpy = vi.fn().mockResolvedValue(undefined)
        store = createStore({
            modules: {
                editor: {
                    namespaced: true,
                    state: { ...getDefaultEditorState() },
                    actions: {
                        updateSourcecode: vi.fn(),
                        close: vi.fn(),
                        openFile: openFileSpy,
                        saveFile: vi.fn().mockResolvedValue(true),
                        cancelLoad: vi.fn(),
                    },
                },
                gui: {
                    namespaced: true,
                    state: {
                        editor: {
                            escToClose: true,
                            confirmUnsavedChanges: true,
                            klipperRestartMethod: 'FIRMWARE_RESTART',
                            tabSize: 2,
                            fileStructureSidebar: true,
                        },
                        general: { language: 'en' },
                    },
                    actions: { saveSetting: vi.fn() },
                },
                server: {
                    namespaced: true,
                    state: { system_info: { available_services: [] } },
                },
                printer: {
                    namespaced: true,
                    state: { app_name: 'Klipper', print_stats: { state: 'standby' }, idle_timeout: { state: 'Idle' } },
                },
            },
        })

        mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })

        expect(openFileSpy).toHaveBeenCalledWith(expect.any(Object), {
            root: 'config',
            path: '',
            filename: 'printer.cfg',
            size: 0,
            permissions: 'rw',
        })
    })

    it('renders file structure sidebar for cfg files with sections', () => {
        store.state.editor.bool = true
        store.state.editor.filename = 'printer.cfg'
        store.state.editor.sourcecode = '[some_section]\nsetting = value\n'
        store.state.editor.permissions = 'rw'
        store.state.gui.editor.fileStructureSidebar = true

        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })

        expect(wrapper.find('.v-treeview').exists()).toBe(true)
    })

    it('does not render file structure sidebar for non-cfg files', () => {
        store.state.editor.bool = true
        store.state.editor.filename = 'readme.txt'
        store.state.editor.sourcecode = 'hello world'
        store.state.editor.permissions = 'rw'
        store.state.gui.editor.fileStructureSidebar = true

        const wrapper = mount(TheEditor, {
            global: {
                plugins: [store],
            },
        })

        expect(wrapper.find('.v-treeview').exists()).toBe(false)
    })
})
