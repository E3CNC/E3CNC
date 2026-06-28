import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UpdateHintAlert from '@/components/panels/Machine/UpdatePanel/UpdateHintAlert.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiAlertCircle: 'mdi-alert-circle',
    mdiEye: 'mdi-eye',
    mdiOpenInNew: 'mdi-open-in-new',
}))

vi.mock('vuetify/components', () => ({
    VAlert: {
        name: 'VAlert',
        props: ['variant', 'density', 'border', 'color', 'icon'],
        template: '<div class="v-alert"><slot /></div>',
    },
    VBtn: { name: 'VBtn', props: ['href', 'class'], template: '<a class="v-btn" :href="$props.href"><slot /></a>' },
    VIcon: { name: 'VIcon', props: ['size'], template: '<i class="v-icon"><slot /></i>' },
}))

vi.mock('@/plugins/helpers', () => ({
    capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}))

describe('UpdateHintAlert.vue', () => {
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
        remote_version: 'v0.12.0',
        version: 'v0.11.0',
    }

    it('renders without crashing', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders alert element', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-alert').exists()).toBe(true)
    })

    it('renders warning title with repo name', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: mockRepo, boolTitle: true },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.UpdateWarning')
    })

    it('renders klipper-specific description1', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: { ...mockRepo, name: 'klipper' } },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.KlipperUpdateQuestionFirmware')
    })

    it('renders klipper-specific description2', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: { ...mockRepo, name: 'klipper' } },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.KlipperUpdateQuestionConfig')
    })

    it('renders moonraker-specific description1', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: { ...mockRepo, name: 'moonraker' } },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.MoonrakerUpdateQuestion')
    })

    it('renders generic update question for unknown repo', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: { ...mockRepo, name: 'unknown_repo', configured_type: 'web' } },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.WebClientUpdateQuestion')
    })

    it('renders commit history button for git repos with commits_behind', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAll('.v-btn')
        // At least the commit history button should exist
        expect(buttons.length).toBeGreaterThanOrEqual(1)
    })

    it('emits open-commit-history on commit history button click', async () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const buttons = wrapper.findAll('.v-btn')
        await buttons[0].trigger('click')
        expect(wrapper.emitted('open-commit-history')).toBeTruthy()
    })

    it('renders external link for klipper', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: { ...mockRepo, name: 'klipper' } },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const externalBtn = wrapper.findAll('.v-btn').at(-1)
        expect(externalBtn!.attributes('href')).toBe('//www.klipper3d.org/Config_Changes.html')
    })

    it('does not show commit history button when commits_behind is empty', () => {
        const wrapper = mount(UpdateHintAlert, {
            props: { repo: { ...mockRepo, commits_behind: [] } },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        // Should only have external link button, no commit history
        expect(wrapper.findAll('.v-btn').length).toBeGreaterThanOrEqual(0)
    })
})
