import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import UpdateHintAll from '@/components/panels/Machine/UpdatePanel/UpdateHintAll.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiProgressQuestion: 'mdi-progress-question',
    mdiCloseThick: 'mdi-close-thick',
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'maxWidth'],
        template: '<div class="v-dialog" v-if="$props.modelValue"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VCheckbox: {
        name: 'VCheckbox',
        props: ['modelValue', 'label', 'hideDetails'],
        template: '<label class="v-checkbox">{{ $props.label }}</label>',
    },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<div class="v-spacer" />' },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'variant', 'color', 'disabled', 'rounded'],
        template: '<button class="v-btn" :disabled="$props.disabled"><slot /></button>',
    },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], cardClass: String, marginBottom: Boolean },
        template:
            '<div class="panel" :class="cardClass"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('@/components/panels/Machine/UpdatePanel/UpdateHintAlert.vue', () => ({
    default: {
        name: 'UpdateHintAlert',
        props: ['repo', 'boolTitle'],
        template: '<div class="update-hint-alert-stub">{{ repo.name }}</div>',
        emits: ['open-commit-history'],
    },
}))

vi.mock('@/components/panels/Machine/UpdatePanel/GitCommitsList.vue', () => ({
    default: {
        name: 'GitCommitsList',
        props: ['modelValue', 'repo'],
        template: '<div class="git-commits-list-stub"></div>',
        emits: ['update:modelValue'],
    },
}))

// Use a simpler semver mock that definitely works
vi.mock('semver', () => {
    const parseVersion = (v: string) => v.replace(/^v/, '').split('.').map(Number)
    const semver = {
        valid: (v: string, _options?: any) => {
            if (!v) return null
            const match = v.match(/^v?(\d+)\.(\d+)\.(\d+)/)
            return match ? `${match[1]}.${match[2]}.${match[3]}` : null
        },
        gt: (a: string, b: string, _options?: any) => {
            const pa = parseVersion(a)
            const pb = parseVersion(b)
            for (let i = 0; i < 3; i++) {
                if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true
                if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false
            }
            return false
        },
    }
    return { default: semver, ...semver }
})

function createMockStore(modules: any[] = []) {
    return createStore({
        state: {},
        getters: {
            'server/updateManager/getUpdateManagerList': () => modules,
        },
    })
}

describe('UpdateHintAll.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not render dialog when modelValue is false', () => {
        const wrapper = mount(UpdateHintAll, {
            props: { modelValue: false },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders dialog when modelValue is true', () => {
        const wrapper = mount(UpdateHintAll, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('renders panel with correct title', () => {
        const wrapper = mount(UpdateHintAll, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel-title').text()).toContain('Machine.UpdatePanel.AreYouSure')
    })

    it('renders the checkbox with label', () => {
        const wrapper = mount(UpdateHintAll, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-checkbox').exists()).toBe(true)
    })

    it('renders abort and start update buttons', () => {
        const wrapper = mount(UpdateHintAll, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.Abort')
        expect(wrapper.text()).toContain('Machine.UpdatePanel.StartUpdate')
    })

    it('start update button is disabled initially', () => {
        const wrapper = mount(UpdateHintAll, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const startBtn = wrapper.findAll('.v-btn').at(-1)
        expect(startBtn!.attributes('disabled')).toBeDefined()
    })

    it('renders UpdateHintAlert for each updateable module', () => {
        const modules = [
            {
                type: 'git',
                data: {
                    name: 'klipper',
                    owner: 'Klipper3d',
                    repo_name: 'klipper',
                    configured_type: 'git_repo',
                    commits_behind: [{ sha: 'abc', subject: 'fix', message: 'fix', author: 'dev', date: 1700000000 }],
                },
            },
            {
                type: 'web',
                data: {
                    name: 'mainsail',
                    owner: 'owner',
                    repo_name: 'repo',
                    configured_type: 'web',
                    remote_version: 'v2.0.0',
                    version: 'v1.0.0',
                },
            },
        ]
        const wrapper = mount(UpdateHintAll, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore(modules)],
                mocks: { $t: (key: string) => key },
            },
        })
        const alerts = wrapper.findAllComponents({ name: 'UpdateHintAlert' })
        expect(alerts.length).toBe(2)
    })

    it('filters out modules that are not updateable', () => {
        const modules = [
            {
                type: 'git',
                data: {
                    name: 'up_to_date',
                    configured_type: 'git_repo',
                    commits_behind: [],
                },
            },
            {
                type: 'web',
                data: {
                    name: 'same_version',
                    configured_type: 'web',
                    remote_version: 'v1.0.0',
                    version: 'v1.0.0',
                },
            },
        ]
        const wrapper = mount(UpdateHintAll, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore(modules)],
                mocks: { $t: (key: string) => key },
            },
        })
        const alerts = wrapper.findAllComponents({ name: 'UpdateHintAlert' })
        expect(alerts.length).toBe(0)
    })

    it('renders GitCommitsList component inside dialog', () => {
        const wrapper = mount(UpdateHintAll, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.findComponent({ name: 'GitCommitsList' }).exists()).toBe(true)
    })
})
