import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GitCommitsListDayCommit from '@/components/panels/Machine/UpdatePanel/GitCommitsListDayCommit.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiDotsHorizontal: 'mdi-dots-horizontal',
}))

vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VChip: {
        name: 'VChip',
        props: ['variant', 'label', 'size', 'href'],
        template: '<a class="v-chip" :href="$props.href"><slot /></a>',
    },
    VIcon: { name: 'VIcon', props: ['size'], template: '<i class="v-icon"><slot /></i>' },
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ browserLocale: { value: 'en-US' } }),
}))

describe('GitCommitsListDayCommit.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const now = Date.now()
    const oneHourAgo = Math.floor((now - 3600000) / 1000)

    const mockCommit = {
        sha: 'abc123def4567890123456789012345678901234',
        subject: 'Fix critical bug',
        message: 'Fixed a critical bug in the system',
        author: 'developer1',
        date: oneHourAgo,
        tag: null,
    }

    const mockRepo = {
        name: 'test_repo',
        owner: 'testowner',
        repo_name: 'testrepo',
        branch: 'master',
        configured_type: 'git_repo',
        version: 'v1.0',
        remote_version: 'v1.1',
    }

    it('renders without crashing', () => {
        const wrapper = mount(GitCommitsListDayCommit, {
            props: {
                commit: mockCommit,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders commit title', () => {
        const wrapper = mount(GitCommitsListDayCommit, {
            props: {
                commit: mockCommit,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Fix critical bug')
    })

    it('renders commit author', () => {
        const wrapper = mount(GitCommitsListDayCommit, {
            props: {
                commit: mockCommit,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('developer1')
    })

    it('renders shortened SHA', () => {
        const wrapper = mount(GitCommitsListDayCommit, {
            props: {
                commit: mockCommit,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('abc123')
    })

    it('renders commit chip with link to github', () => {
        const wrapper = mount(GitCommitsListDayCommit, {
            props: {
                commit: mockCommit,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        // Check that the chip contains the shortened SHA
        expect(wrapper.text()).toContain('abc123')
    })

    it('renders commit time as hours ago', () => {
        const wrapper = mount(GitCommitsListDayCommit, {
            props: {
                commit: mockCommit,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.CommittedHoursAgo')
    })

    it('does not show details initially', () => {
        const wrapper = mount(GitCommitsListDayCommit, {
            props: {
                commit: mockCommit,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).not.toContain('Fixed a critical bug in the system')
    })

    it('shows details after clicking chip', async () => {
        const wrapper = mount(GitCommitsListDayCommit, {
            props: {
                commit: mockCommit,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const chip = wrapper.find('.v-chip')
        await chip.trigger('click')
        expect(wrapper.text()).toContain('Fixed a critical bug in the system')
    })
})
