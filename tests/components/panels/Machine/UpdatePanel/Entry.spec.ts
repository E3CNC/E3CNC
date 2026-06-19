import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import Entry from '@/components/panels/Machine/UpdatePanel/Entry.vue'

const mockBaseValues = vi.hoisted(() => ({
    printer_state: { value: 'ready', __v_isRef: true },
}))

const mockSocket = vi.hoisted(() => ({
    emit: vi.fn(),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => mockBaseValues,
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => mockSocket,
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('semver', () => ({
    default: { valid: vi.fn(() => true), gt: vi.fn((a: string, b: string) => a !== b) },
    valid: vi.fn((v: string) => (v && v !== '?' ? v : null)),
    gt: vi.fn((a: string, b: string) => {
        if (a === 'v2.13.0' && b === 'v2.12.0') return true
        if (a === 'v0.13.0' && b === 'v0.12.0') return true
        return false
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VRow: { name: 'VRow', template: '<div :class="$attrs.class"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div :class="$attrs.class"><slot /></div>' },
    VIcon: { name: 'VIcon', props: ['size', 'start'], template: '<i class="v-icon" />' },
    VBtn: {
        name: 'VBtn',
        props: ['variant', 'color', 'size', 'disabled'],
        template: '<button :class="$attrs.class" @click="$attrs.onClick || $attrs.click"><slot /></button>',
    },
    VAlert: {
        name: 'VAlert',
        props: ['density', 'variant', 'color', 'border', 'icon'],
        template: '<div><slot /></div>',
    },
    VChip: {
        name: 'VChip',
        props: ['size', 'label', 'variant', 'outlined', 'color', 'disabled'],
        template: '<span :class="$attrs.class" @click="$attrs.onClick || $attrs.click"><slot /></span>',
    },
    VMenu: { name: 'VMenu', props: ['offsetY'], template: '<div><slot name="activator" /><slot /></div>' },
    VList: { name: 'VList', props: ['density'], template: '<div><slot /></div>' },
    VListItem: {
        name: 'VListItem',
        props: ['disabled'],
        template: '<div @click="$attrs.onClick || $attrs.click"><slot name="prepend" /><slot name="title" /></div>',
    },
    VListItemTitle: { name: 'VListItemTitle', template: '<span><slot /></span>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@/components/panels/Machine/UpdatePanel/GitCommitsList.vue', () => ({
    default: {
        name: 'GitCommitsList',
        props: ['modelValue', 'repo'],
        template: '<div class="git-commits-list" />',
    },
}))

vi.mock('@/components/panels/Machine/UpdatePanel/UpdateHint.vue', () => ({
    default: {
        name: 'UpdateHint',
        props: ['modelValue', 'repo'],
        template: '<div class="update-hint" />',
        emits: ['update:model-value', 'open-commit-history', 'do-update'],
    },
}))

const $t = (key: string) => key

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: [] },
            printer: {
                print_stats: { state: 'standby' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
            },
            gui: {
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                },
                general: { printername: 'Test' },
                control: {},
                uiSettings: { hideUpdateWarnings: false },
                navigationSettings: { entries: [] },
            },
            files: {},
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'gui/getPanelExpand': () => () => true,
            ...(overrides.getters || {}),
        },
    })
}

const sampleGitRepo = {
    name: 'mainsail',
    repo_name: 'mainsail',
    owner: 'mainsail-crew',
    configured_type: 'git_repo',
    version: 'v2.12.0',
    remote_version: 'v2.13.0',
    branch: 'master',
    remote_alias: 'origin',
    is_valid: true,
    is_dirty: false,
    corrupt: false,
    detached: false,
    commits_behind: [{ sha: 'abc123', author: 'dev', date: 1700000000, subject: 'fix: bug', message: '', tag: null }],
    info_tags: ['desc=Mainsail'],
    anomalies: [],
    warnings: [],
}

describe('UpdatePanel Entry.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockBaseValues.printer_state.value = 'ready'
    })

    it('renders name from info_tags description', () => {
        const store = createStoreWithState()
        const wrapper = mount(Entry, {
            props: { repo: sampleGitRepo },
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('Mainsail')
    })

    it('renders raw name when no info_tags description', () => {
        const store = createStoreWithState()
        const wrapper = mount(Entry, {
            props: {
                repo: { ...sampleGitRepo, info_tags: [] },
            },
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('mainsail')
    })

    it('renders update available indication when git repo has commits behind (no semver update)', () => {
        const store = createStoreWithState()
        // Same versions so semverUpdatable is false, but commits_behind is non-empty
        const repo = {
            ...sampleGitRepo,
            version: 'v2.12.0',
            remote_version: 'v2.12.0',
            commits_behind: [
                { sha: 'abc123', author: 'dev', date: 1700000000, subject: 'fix: bug', message: '', tag: null },
            ],
        }
        const wrapper = mount(Entry, {
            props: { repo },
            global: { plugins: [store], mocks: { $t } },
        })

        // The versionOutput shows the commits via t('Machine.UpdatePanel.CommitsAvailable')
        expect(wrapper.text()).toContain('Machine.UpdatePanel.CommitsAvailable')
    })

    it('renders up-to-date state when no updates available', () => {
        const store = createStoreWithState()
        const repo = {
            ...sampleGitRepo,
            commits_behind: [],
            remote_version: 'v2.12.0',
            version: 'v2.12.0',
        }
        const wrapper = mount(Entry, {
            props: { repo },
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('Machine.UpdatePanel.UpToDate')
    })

    it('shows warning alerts when repo has warnings', () => {
        const store = createStoreWithState()
        const repo = {
            ...sampleGitRepo,
            warnings: ['This repo is not trusted', 'Dependency issue detected'],
            commits_behind: [],
            remote_version: 'v2.12.0',
            version: 'v2.12.0',
        }
        const wrapper = mount(Entry, {
            props: { repo },
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('This repo is not trusted')
        expect(wrapper.text()).toContain('Dependency issue detected')
    })

    it('shows anomaly content when anomalies exist', () => {
        const store = createStoreWithState()
        const repo = {
            ...sampleGitRepo,
            anomalies: ['Branch not found: master'],
            commits_behind: [],
            remote_version: 'v2.12.0',
            version: 'v2.12.0',
        }
        const wrapper = mount(Entry, {
            props: { repo },
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('Branch not found: master')
    })

    it('shows corrupt status for corrupt repos', () => {
        const store = createStoreWithState()
        const repo = {
            ...sampleGitRepo,
            is_valid: false,
            corrupt: true,
            recovery_url: 'https://example.com/recover',
            commits_behind: [],
        }
        const wrapper = mount(Entry, {
            props: { repo },
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('Machine.UpdatePanel.Corrupt')
    })

    it('shows dirty status for dirty repos', () => {
        const store = createStoreWithState()
        const repo = {
            ...sampleGitRepo,
            is_valid: false,
            is_dirty: true,
            commits_behind: [],
            remote_version: 'v2.12.0',
            version: 'v2.12.0',
        }
        const wrapper = mount(Entry, {
            props: { repo },
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.text()).toContain('Machine.UpdatePanel.Dirty')
    })

    it('renders UNKNOWN version and up-to-date status for repos with null versions', () => {
        const store = createStoreWithState()
        const repo = {
            ...sampleGitRepo,
            commits_behind: [],
            version: null as any,
            remote_version: null as any,
        }
        const wrapper = mount(Entry, {
            props: { repo },
            global: { plugins: [store], mocks: { $t } },
        })

        // versionOutput returns '?' fallback when localVersion is null
        expect(wrapper.text()).toContain('?')
        // btnText returns 'UpToDate' since the repo is valid and has no updates
        expect(wrapper.text()).toContain('Machine.UpdatePanel.UpToDate')
    })

    it('renders GitCommitsList child component', () => {
        const store = createStoreWithState()
        const wrapper = mount(Entry, {
            props: { repo: sampleGitRepo },
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.find('.git-commits-list').exists()).toBe(true)
    })

    it('renders UpdateHint child component', () => {
        const store = createStoreWithState()
        const wrapper = mount(Entry, {
            props: { repo: sampleGitRepo },
            global: { plugins: [store], mocks: { $t } },
        })

        expect(wrapper.find('.update-hint').exists()).toBe(true)
    })
})
