import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UpdateHint from '@/components/panels/Machine/UpdatePanel/UpdateHint.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiProgressQuestion: 'mdi-progress-question',
    mdiCloseThick: 'mdi-close-thick',
}))

vi.mock('vuetify/components', () => ({
    VDialog: { name: 'VDialog', props: ['modelValue', 'maxWidth'], template: '<div class="v-dialog" v-if="$props.modelValue"><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VCheckbox: { name: 'VCheckbox', props: ['modelValue', 'label', 'hideDetails'], template: '<label class="v-checkbox">{{ $props.label }}</label>' },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<div class="v-spacer" />' },
    VBtn: { name: 'VBtn', props: ['icon', 'variant', 'color', 'disabled', 'rounded'], template: '<button class="v-btn" :disabled="$props.disabled"><slot /></button>' },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], cardClass: String, marginBottom: Boolean },
        template: '<div class="panel" :class="cardClass"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
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

describe('UpdateHint.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const mockRepo = {
        name: 'klipper',
        owner: 'Klipper3d',
        repo_name: 'klipper',
        branch: 'master',
        commits_behind: [{ sha: 'abc', subject: 'fix', message: 'fix', author: 'dev', date: 1700000000 }],
        configured_type: 'git_repo',
    }

    it('does not render dialog when modelValue is false', () => {
        const wrapper = mount(UpdateHint, {
            props: { modelValue: false, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders dialog when modelValue is true', () => {
        const wrapper = mount(UpdateHint, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('renders panel with correct title', () => {
        const wrapper = mount(UpdateHint, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel-title').text()).toContain('Machine.UpdatePanel.AreYouSure')
    })

    it('renders UpdateHintAlert child component', () => {
        const wrapper = mount(UpdateHint, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.findComponent({ name: 'UpdateHintAlert' }).exists()).toBe(true)
    })

    it('renders the checkbox with label', () => {
        const wrapper = mount(UpdateHint, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-checkbox').exists()).toBe(true)
    })

    it('start update button is disabled initially', () => {
        const wrapper = mount(UpdateHint, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const startBtn = wrapper.findAll('.v-btn').at(-1)
        expect(startBtn!.attributes('disabled')).toBeDefined()
    })

    it('renders abort and start update buttons in card-actions', () => {
        const wrapper = mount(UpdateHint, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.Abort')
        expect(wrapper.text()).toContain('Machine.UpdatePanel.StartUpdate')
    })

    it('emits open-commit-history when UpdateHintAlert emits it', async () => {
        const wrapper = mount(UpdateHint, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const alert = wrapper.findComponent({ name: 'UpdateHintAlert' })
        await alert.vm.$emit('open-commit-history')
        expect(wrapper.emitted('open-commit-history')).toBeTruthy()
    })
})
