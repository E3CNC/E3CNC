import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import TheSettingsMenu from '@/components/TheSettingsMenu.vue'

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
        constructor(v: any) {
            this._value = v
        }
        get value() {
            return this._value
        }
        set value(v) {
            this._value = v
        }
    }
    return new MockRef(false)
})

// ── Module-level mocks ─────────────────────────────────────

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
    createI18n: () => ({
        global: {
            setLocaleMessage: vi.fn(),
            locale: { value: 'en' },
            t: (key: string) => key,
        },
    }),
}))

vi.mock('@/plugins/i18n', () => ({
    default: {
        global: {
            setLocaleMessage: vi.fn(),
            locale: { value: 'en' },
            t: (key: string) => key,
        },
    },
    setAndLoadLocale: vi.fn(),
}))

vi.mock('vue-router', () => ({
    useRoute: () => mockRouteReactive,
    useRouter: () => ({ replace: mockRouterReplace }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        isMobile: mockIsMobile,
    }),
}))

vi.mock('@mdi/js', () => ({
    mdiCloseThick: 'MdiCloseThick',
    mdiCodeTags: 'MdiCodeTags',
    mdiCog: 'MdiCog',
    mdiCogs: 'MdiCogs',
    mdiConsoleLine: 'MdiConsoleLine',
    mdiDipSwitch: 'MdiDipSwitch',
    mdiFileDocumentEditOutline: 'MdiFileDocumentEditOutline',
    mdiMonitorDashboard: 'MdiMonitorDashboard',
    mdiPalette: 'MdiPalette',
    mdiPrinter3d: 'MdiPrinter3d',
    mdiVideo3d: 'MdiVideo3d',
    mdiWebcam: 'MdiWebcam',
    mdiMenu: 'MdiMenu',
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'width', 'persistent', 'fullscreen', 'scrollable'],
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VBtn: {
        name: 'VBtn',
        props: ['icon'],
        template: '<button class="v-btn"><slot /></button>',
    },
    VIcon: {
        name: 'VIcon',
        props: ['icon'],
        template: '<i class="v-icon">{{ icon }}</i>',
    },
    VCard: {
        name: 'VCard',
        template: '<div class="v-card"><slot /></div>',
    },
    VToolbar: {
        name: 'VToolbar',
        props: ['flat', 'density'],
        template: '<div class="v-toolbar"><slot /></div>',
    },
    VToolbarTitle: {
        name: 'VToolbarTitle',
        template: '<span class="v-toolbar-title"><slot /></span>',
    },
    VSpacer: {
        name: 'VSpacer',
        template: '<div class="v-spacer" />',
    },
    VCardText: {
        name: 'VCardText',
        template: '<div class="v-card-text"><slot /></div>',
    },
    VTabs: {
        name: 'VTabs',
        props: ['modelValue', 'direction', 'centerActive', 'showArrows'],
        template: '<div class="v-tabs"><slot /></div>',
    },
    VTab: {
        name: 'VTab',
        props: ['value'],
        template: '<button class="v-tab"><slot /></button>',
    },
    VRow: {
        name: 'VRow',
        props: ['class'],
        template: '<div class="v-row"><slot /></div>',
    },
    VCol: {
        name: 'VCol',
        props: ['cols', 'class'],
        template: '<div class="v-col"><slot /></div>',
    },
}))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: {
        name: 'OverlayScrollbarsComponent',
        props: ['options'],
        template: '<div class="overlayscrollbars"><slot /></div>',
        setup() {
            return {
                osInstance: () => ({
                    elements: () => ({ viewport: null }),
                }),
            }
        },
    },
}))

// Mock all 11 settings tab components
vi.mock('@/components/settings/SettingsGeneralTab.vue', () => ({
    default: {
        name: 'SettingsGeneralTab',
        template: '<div class="settings-general-tab-stub">General</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsWebcamsTab.vue', () => ({
    default: {
        name: 'SettingsWebcamsTab',
        template: '<div class="settings-webcams-tab-stub">Webcams</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsMacrosTab.vue', () => ({
    default: {
        name: 'SettingsMacrosTab',
        template: '<div class="settings-macros-tab-stub">Macros</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsConsoleTab.vue', () => ({
    default: {
        name: 'SettingsConsoleTab',
        template: '<div class="settings-console-tab-stub">Console</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsRemotePrintersTab.vue', () => ({
    default: {
        name: 'SettingsRemotePrintersTab',
        template: '<div class="settings-remote-printers-tab-stub">Remote Printers</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsUiSettingsTab.vue', () => ({
    default: {
        name: 'SettingsUiSettingsTab',
        template: '<div class="settings-ui-settings-tab-stub">UI Settings</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsDashboardTab.vue', () => ({
    default: {
        name: 'SettingsDashboardTab',
        template: '<div class="settings-dashboard-tab-stub">Dashboard</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsGCodeViewerTab.vue', () => ({
    default: {
        name: 'SettingsGCodeViewerTab',
        template: '<div class="settings-gcode-viewer-tab-stub">GCode Viewer</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsEditorTab.vue', () => ({
    default: {
        name: 'SettingsEditorTab',
        template: '<div class="settings-editor-tab-stub">Editor</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsNavigationTab.vue', () => ({
    default: {
        name: 'SettingsNavigationTab',
        template: '<div class="settings-navigation-tab-stub">Navigation</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

vi.mock('@/components/settings/SettingsMiscellaneousTab.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTab',
        template: '<div class="settings-miscellaneous-tab-stub">Miscellaneous</div>',
        emits: ['scroll-to-top', 'reset-layout'],
    },
}))

// ── Tests ──────────────────────────────────────────────────

describe('TheSettingsMenu.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        mockRouterReplace.mockReset()
        mockRouteReactive.query = {}
        mockRouteReactive.path = '/'
        mockIsMobile.value = false

        store = createStore({
            state: {},
        })
    })

    it('renders without crashing', () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the settings button', () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        expect(btn.exists()).toBe(true)
    })

    it('does not show the dialog initially', () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('opens the dialog when the settings button is clicked', async () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        await btn.trigger('click')
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('opens the dialog and renders the settings card', async () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        await btn.trigger('click')

        expect(wrapper.find('.v-card').exists()).toBe(true)
    })

    it('renders the toolbar with title', async () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        await btn.trigger('click')

        expect(wrapper.find('.v-toolbar').exists()).toBe(true)
        expect(wrapper.find('.v-toolbar-title').exists()).toBe(true)
        expect(wrapper.find('.v-toolbar-title').text()).toContain('Settings.InterfaceSettings')
    })

    it('renders the close button in the toolbar', async () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        await btn.trigger('click')

        // The toolbar has a close button (v-btn with mdiCloseThick)
        const toolbarBtns = wrapper.findAll('.v-toolbar .v-btn')
        expect(toolbarBtns.length).toBeGreaterThanOrEqual(1)
    })

    it('closes the dialog when close button is clicked', async () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        // Open
        const openBtn = wrapper.find('.v-btn')
        await openBtn.trigger('click')
        expect(wrapper.find('.v-dialog').exists()).toBe(true)

        // Close
        const closeBtn = wrapper.findAll('.v-btn')[1]
        await closeBtn.trigger('click')
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders tabs with settings tab names (desktop view)', async () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        await btn.trigger('click')

        // Desktop: vertical tabs in the sidebar
        expect(wrapper.find('.v-tabs').exists()).toBe(true)
    })

    it('renders the overlay scrollbars component', async () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        await btn.trigger('click')

        expect(wrapper.find('.overlayscrollbars').exists()).toBe(true)
    })

    it('renders default tab component (general)', async () => {
        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        await btn.trigger('click')

        // The general tab should be rendered by default
        expect(wrapper.find('.settings-general-tab-stub').exists()).toBe(true)
    })

    it('opens the menu when query param settingsMenu is present', () => {
        mockRouteReactive.query = { settingsMenu: 'general' }

        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('renders mobile tabs when isMobile is true', async () => {
        mockIsMobile.value = true

        const wrapper = mount(TheSettingsMenu, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        await btn.trigger('click')

        // In mobile mode, tabs are rendered
        expect(wrapper.find('.v-tabs').exists()).toBe(true)
    })
})
