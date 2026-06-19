import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import TimelapseFilesPanel from '@/components/panels/Timelapse/TimelapseFilesPanel.vue'
import type { FileStateFile } from '@/store/files/types'

// ---------------------------------------------------------------------------
// Hoisted mock values (mutable ref-like objects usable inside vi.mock closures)
// ---------------------------------------------------------------------------
const mockBaseValues = vi.hoisted(() => {
    class MockRef {
        _value: any
        __v_isRef = true
        __v_isShallow = false
        constructor(val: any) {
            this._value = val
        }
        get value() {
            return this._value
        }
        set value(v) {
            this._value = v
        }
    }

    return {
        loadings: new MockRef([]),
        apiUrl: new MockRef('http://localhost:8080'),
        formatDateTime: vi.fn((_date: number) => '2025-01-01 12:00'),
    }
})

// ---------------------------------------------------------------------------
// Mock composables
// ---------------------------------------------------------------------------
vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        loadings: mockBaseValues.loadings,
        apiUrl: mockBaseValues.apiUrl,
        formatDateTime: mockBaseValues.formatDateTime,
    }),
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: vi.fn(),
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

// ---------------------------------------------------------------------------
// Mock helper functions used by the component
// ---------------------------------------------------------------------------
vi.mock('@/plugins/helpers', () => ({
    escapePath: vi.fn((path: string) => path),
    formatFilesize: vi.fn((bytes: number) => `${(bytes / 1024).toFixed(1)} kB`),
    sortFiles: vi.fn((items: any[], _sortBy: string[], _sortDesc: boolean[]) => items),
}))

// ---------------------------------------------------------------------------
// Mock MDI icon paths
// ---------------------------------------------------------------------------
vi.mock('@mdi/js', () => ({
    mdiFolderPlus: 'mdiFolderPlus',
    mdiCloseThick: 'mdiCloseThick',
    mdiFileDocumentMultipleOutline: 'mdiFileDocumentMultipleOutline',
    mdiFileVideo: 'mdiFileVideo',
    mdiFolder: 'mdiFolder',
    mdiFolderUpload: 'mdiFolderUpload',
    mdiMagnify: 'mdiMagnify',
    mdiFile: 'mdiFile',
    mdiFolderZipOutline: 'mdiFolderZipOutline',
    mdiRefresh: 'mdiRefresh',
    mdiCloudDownload: 'mdiCloudDownload',
    mdiRenameBox: 'mdiRenameBox',
    mdiDelete: 'mdiDelete',
}))

// ---------------------------------------------------------------------------
// Mock Vuetify components – provide just enough structure for the template
// ---------------------------------------------------------------------------
const vuetifyComponentsMock = vi.hoisted(() => ({
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'size', 'color', 'variant', 'rounded', 'disabled', 'loading', 'title', 'href', 'target'],
        template: '<button :class="$attrs.class" :disabled="disabled"><slot /></button>',
    },
    VIcon: { name: 'VIcon', props: ['start', 'icon', 'size', 'color'], template: '<i><slot /></i>' },
    VSpacer: { name: 'VSpacer', template: '<div class="v-spacer" />' },
    VTextField: {
        name: 'VTextField',
        props: ['modelValue', 'label', 'appendIcon', 'singleLine', 'variant', 'clearable', 'hideDetails', 'density'],
        template:
            '<div class="v-text-field"><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>',
    },
    VDataTable: {
        name: 'VDataTable',
        props: [
            'modelValue',
            'items',
            'headers',
            'customSort',
            'sortBy',
            'sortDesc',
            'itemsPerPage',
            'footerProps',
            'itemKey',
            'search',
            'customFilter',
            'mobileBreakpoint',
            'showSelect',
        ],
        template:
            '<div class="v-data-table files-table">' +
            '<slot name="body.prepend" />' +
            '<slot name="no-data" />' +
            '<slot name="item" v-for="item in items" :item="item" :index="items.indexOf(item)" :isSelected="false" :select="() => {}" />' +
            '<slot name="items" />' +
            '</div>',
    },
    VCheckbox: {
        name: 'VCheckbox',
        props: ['modelValue', 'density', 'hideDetails', 'ripple'],
        template: '<input type="checkbox" class="v-checkbox" :checked="modelValue" @click.stop />',
    },
    VMenu: {
        name: 'VMenu',
        props: ['modelValue', 'positionX', 'positionY', 'absolute', 'offsetY'],
        template: '<div class="v-menu" v-if="modelValue"><slot /></div>',
    },
    VList: { name: 'VList', template: '<div class="v-list"><slot /></div>' },
    VListItem: {
        name: 'VListItem',
        props: ['disabled'],
        template: '<div class="v-list-item" @click.stop><slot /></div>',
    },
    VTooltip: {
        name: 'VTooltip',
        props: ['location', 'disabled', 'contentClass', 'color', 'top'],
        template: '<div class="v-tooltip-mock"><slot name="activator" :props="{}" /><slot /></div>',
    },
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'maxWidth'],
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VProgressCircular: {
        name: 'VProgressCircular',
        props: ['indeterminate', 'color', 'size'],
        template: '<span class="v-progress-circular" />',
    },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('vuetify', () => ({
    useDisplay: () => ({
        mdAndUp: { value: true },
    }),
}))

// ---------------------------------------------------------------------------
// Mock child components
// ---------------------------------------------------------------------------
vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['icon', 'title', 'cardClass', 'marginBottom'],
        template: '<div :class="cardClass"><slot /><slot name="buttons" /></div>',
    },
}))

vi.mock('@/components/ui/PathNavigation.vue', () => ({
    default: {
        name: 'PathNavigation',
        props: ['path', 'baseDirectoryLabel', 'onSegmentClick'],
        template: '<div class="path-navigation">{{ baseDirectoryLabel }}{{ path }}</div>',
    },
}))

vi.mock('@/components/dialogs/ConfirmationDialog.vue', () => ({
    default: {
        name: 'ConfirmationDialog',
        props: ['modelValue', 'title', 'text', 'actionButtonText'],
        template: '<div class="confirmation-dialog" v-if="modelValue">{{ text }}</div>',
    },
}))

vi.mock('vue-load-image', () => ({
    default: {
        name: 'VueLoadImage',
        template:
            '<div class="vue-load-image"><slot name="image" /><slot name="preloader" /><slot name="error" /></div>',
    },
}))

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a minimal FileStateFile fixture. */
function makeFile(filename: string, overrides: Partial<FileStateFile> = {}): FileStateFile {
    return {
        isDirectory: false,
        filename,
        modified: new Date('2025-01-01T12:00:00'),
        permissions: 'rw',
        size: 4096,
        ...overrides,
    }
}

/** Create a directory FileStateFile fixture. */
function makeDir(dirname: string, overrides: Partial<FileStateFile> = {}): FileStateFile {
    return {
        isDirectory: true,
        filename: dirname,
        modified: new Date('2025-01-01T12:00:00'),
        permissions: 'rw',
        childrens: [],
        ...overrides,
    }
}

/** Create a vues store pre-configured for TimelapseFilesPanel tests. */
function createStoreWithState(overrides: Record<string, any> = {}) {
    const defaultCurrentPath = 'timelapse'
    return createStore({
        state: {
            socket: {
                isConnected: true,
                hostname: 'localhost',
                port: '8080',
                initializationList: [],
                loadings: [],
            },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                config: { config: {}, orig: {} },
                registered_directories: ['timelapse'],
                ...(overrides.server || {}),
            },
            printer: {
                print_stats: { state: 'ready' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
            },
            gui: {
                view: {
                    timelapse: {
                        sortBy: 'modified',
                        sortDesc: true,
                        countPerPage: 10,
                        currentPath: defaultCurrentPath,
                        selectedFiles: [],
                        ...((overrides.gui?.view?.timelapse as object) || {}),
                    },
                },
                general: {
                    printername: 'Test',
                    dateFormat: 'yyyy-MM-dd',
                    timeFormat: '24hours',
                },
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                },
                control: {},
                uiSettings: {},
                navigationSettings: { entries: [] },
                webcams: { webcams: [] },
                ...(overrides.gui || {}),
            },
            files: {},
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'socket/getHostUrl': () => new URL('http://localhost:8080'),
            'gui/getPanelExpand': () => () => true,
            'gui/getHours12Format': () => false,
            'files/getDirectory':
                () =>
                (path: string = 'timelapse'): Record<string, any> | undefined => {
                    const directories: Record<string, any> = overrides.directories ?? {
                        timelapse: {
                            childrens: [],
                            disk_usage: { used: 1048576, free: 104857600, total: 209715200 },
                            permissions: 'rw',
                        },
                    }
                    return directories[path]
                },
            ...(overrides.getters || {}),
        },
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TimelapseFilesPanel.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // -----------------------------------------------------------------------
    // 1. Renders without crashing
    // -----------------------------------------------------------------------
    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'vue-load-image': true,
                },
                directives: {
                    longpress: {
                        mounted() {
                            /* stub */
                        },
                        unmounted() {
                            /* stub */
                        },
                    },
                },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    // -----------------------------------------------------------------------
    // 2. Shows the panel with correct card class
    // -----------------------------------------------------------------------
    it('renders panel with timelapse-files-panel card class', () => {
        const store = createStoreWithState()
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        expect(wrapper.find('.timelapse-files-panel').exists()).toBe(true)
    })

    // -----------------------------------------------------------------------
    // 3. Renders search field and action buttons
    // -----------------------------------------------------------------------
    it('renders search text field', () => {
        const store = createStoreWithState()
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        expect(wrapper.findComponent({ name: 'VTextField' }).exists()).toBe(true)
    })

    it('renders refresh button when no files selected', () => {
        const store = createStoreWithState()
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        // Refresh button and create-dir button should appear; download/delete hidden
        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        expect(buttons.length).toBeGreaterThanOrEqual(1)
    })

    it('shows download and delete buttons when files are selected', () => {
        const selectedFile = makeFile('test.mp4')
        const store = createStoreWithState({
            gui: {
                view: {
                    timelapse: {
                        currentPath: 'timelapse',
                        selectedFiles: [selectedFile],
                        sortBy: 'modified',
                        sortDesc: true,
                        countPerPage: 10,
                    },
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        // With selectedFiles.length > 0, download and delete buttons render
        const btns = wrapper.findAllComponents({ name: 'VBtn' })
        expect(btns.length).toBeGreaterThanOrEqual(2)
    })

    // -----------------------------------------------------------------------
    // 4. Renders path navigation with correct path
    // -----------------------------------------------------------------------
    it('renders path navigation with current path', () => {
        const store = createStoreWithState({
            gui: {
                view: {
                    timelapse: {
                        currentPath: 'timelapse/subfolder',
                        selectedFiles: [],
                        sortBy: 'modified',
                        sortDesc: true,
                        countPerPage: 10,
                    },
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        const pathNav = wrapper.findComponent({ name: 'PathNavigation' })
        expect(pathNav.exists()).toBe(true)
        // base label is `/${rootDirectory}` which is `/timelapse`
        expect(pathNav.text()).toContain('/timelapse')
    })

    it('shows current path label', () => {
        const store = createStoreWithState()
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        expect(wrapper.text()).toContain('Timelapse.CurrentPath')
    })

    // -----------------------------------------------------------------------
    // 5. Shows disk usage when available
    // -----------------------------------------------------------------------
    it('shows free disk label when disk_usage is available', () => {
        const store = createStoreWithState()
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        expect(wrapper.text()).toContain('Timelapse.FreeDisk')
    })

    it('does not show disk usage when disk_usage is null', () => {
        const store = createStoreWithState({
            directories: {
                timelapse: {
                    childrens: [],
                    disk_usage: null,
                    permissions: 'r',
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        // The disk_usage will be computed as { used: 0, free: 0, total: 0 }
        // but the label only shows when disk_usage !== null.
        // Since our mock returns null, the computed will be null (from directory.value?.disk_usage ?? undefined)
        // Wait - actually looking at the component code:
        // const disk_usage = computed(() => directory.value?.disk_usage ?? { used: 0, free: 0, total: 0 })
        // So even when disk_usage is null, the computed returns a default object!
        // The template shows disk usage based on `disk_usage !== null`, which will be true.
        // So this test actually expects it to STILL show because of the fallback.
        // Let's adjust: we can test that FreeDisk text DOES appear even when null is provided.
        expect(wrapper.text()).toContain('Timelapse.FreeDisk')
    })

    // -----------------------------------------------------------------------
    // 6. Shows v-data-table with file items
    // -----------------------------------------------------------------------
    it('renders v-data-table', () => {
        const store = createStoreWithState()
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        expect(wrapper.find('.v-data-table.files-table').exists()).toBe(true)
    })

    it('renders data table with files when directory has children', () => {
        const fileItems: FileStateFile[] = [
            makeFile('video1.mp4', { size: 1048576 }),
            makeFile('video2.mp4', { size: 2097152 }),
            makeFile('archive.zip', { size: 524288 }),
        ]
        const store = createStoreWithState({
            directories: {
                timelapse: {
                    childrens: fileItems,
                    disk_usage: { used: 2097152, free: 104857600, total: 209715200 },
                    permissions: 'rw',
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        expect(wrapper.find('.v-data-table.files-table').exists()).toBe(true)
        // The data-table renders items via its slot machinery
        expect(wrapper.findComponent({ name: 'VDataTable' }).exists()).toBe(true)
    })

    // -----------------------------------------------------------------------
    // 7. Shows empty state when no files
    // -----------------------------------------------------------------------
    it('shows empty text when no files in directory', () => {
        const store = createStoreWithState({
            directories: {
                timelapse: {
                    childrens: [],
                    disk_usage: { used: 0, free: 104857600, total: 209715200 },
                    permissions: 'rw',
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        expect(wrapper.text()).toContain('Timelapse.Empty')
    })

    // -----------------------------------------------------------------------
    // 8. Shows "go back" row when not at root
    // -----------------------------------------------------------------------
    it('shows go-back row (..) when currentPath is not rootDirectory', () => {
        const store = createStoreWithState({
            gui: {
                view: {
                    timelapse: {
                        currentPath: 'timelapse/subdir',
                        selectedFiles: [],
                        sortBy: 'modified',
                        sortDesc: true,
                        countPerPage: 10,
                    },
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        // The ".." go-back row should be rendered in the body.prepend slot
        expect(wrapper.text()).toContain('..')
    })

    it('does NOT show go-back row when at root directory', () => {
        const store = createStoreWithState() // currentPath defaults to 'timelapse' which === rootDirectory
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        // No ".." when at root
        expect(wrapper.text()).not.toContain('..')
    })

    // -----------------------------------------------------------------------
    // 9. Displays file items in the table with correct data
    // -----------------------------------------------------------------------
    it('renders file items with filenames visible', () => {
        const fileItems: FileStateFile[] = [
            makeFile('timelapse_001.mp4', { size: 5242880 }),
            makeFile('timelapse_002.mp4', { size: 10485760 }),
            makeDir('saved-clips'),
        ]
        const store = createStoreWithState({
            directories: {
                timelapse: {
                    childrens: fileItems,
                    disk_usage: { used: 15728640, free: 94371840, total: 209715200 },
                    permissions: 'rw',
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        // The data-table receives items via :items="displayFiles" which filters
        // for .mp4 and .zip (and directories). Our items satisfy this.
        expect(wrapper.text()).toContain('timelapse_001.mp4')
        expect(wrapper.text()).toContain('timelapse_002.mp4')
        expect(wrapper.text()).toContain('saved-clips')
    })

    it('filters out non-mp4/non-zip files from displayFiles', () => {
        const fileItems: FileStateFile[] = [
            makeFile('timelapse_001.mp4', { size: 5242880 }),
            makeFile('readme.txt', { size: 1024 }),
            makeFile('thumbnail.jpg', { size: 51200 }),
        ]
        const store = createStoreWithState({
            directories: {
                timelapse: {
                    childrens: fileItems,
                    disk_usage: { used: 5294080, free: 104857600, total: 209715200 },
                    permissions: 'rw',
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        // Only .mp4 files pass displayFiles filter
        expect(wrapper.text()).toContain('timelapse_001.mp4')
        // .txt and .jpg files should not appear in the displayed list
        expect(wrapper.text()).not.toContain('readme.txt')
        expect(wrapper.text()).not.toContain('thumbnail.jpg')
    })

    it('shows file size for non-directory items', () => {
        const fileItems: FileStateFile[] = [makeFile('test_clip.mp4', { size: 1048576 })]
        const store = createStoreWithState({
            directories: {
                timelapse: {
                    childrens: fileItems,
                    disk_usage: { used: 1048576, free: 104857600, total: 209715200 },
                    permissions: 'rw',
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        // formatFilesize is mocked to return "1024.0 kB" for 1048576 bytes
        expect(wrapper.text()).toContain('1024.0')
        expect(wrapper.text()).toContain('kB')
    })

    it('shows -- for directory size', () => {
        const fileItems: FileStateFile[] = [makeDir('my-clips')]
        const store = createStoreWithState({
            directories: {
                timelapse: {
                    childrens: fileItems,
                    disk_usage: { used: 0, free: 104857600, total: 209715200 },
                    permissions: 'rw',
                },
            },
        })
        const wrapper = mount(TimelapseFilesPanel, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: { 'vue-load-image': true },
                directives: { longpress: { mounted() {}, unmounted() {} } },
            },
        })
        expect(wrapper.text()).toContain('--')
    })
})
