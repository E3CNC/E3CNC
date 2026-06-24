import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GitCommitsListDay from '@/components/panels/Machine/UpdatePanel/GitCommitsListDay.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vuetify/components', () => ({
    VTimelineItem: { name: 'VTimelineItem', props: ['size'], template: '<div class="v-timeline-item"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
}))

vi.mock('@/components/panels/Machine/UpdatePanel/GitCommitsListDayCommit.vue', () => ({
    default: {
        name: 'GitCommitsListDayCommit',
        props: ['commit', 'repo'],
        template: '<div class="git-commit-day-commit-stub">{{ commit.subject }}</div>',
    },
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ browserLocale: { value: 'en-US' } }),
}))

describe('GitCommitsListDay.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const mockGroupedCommits = {
        date: new Date('2024-01-15'),
        commits: [
            { sha: 'abc123', subject: 'Fix bug', message: 'Fixed a bug', author: 'dev', date: 1705276800 },
            { sha: 'def456', subject: 'Add feature', message: 'Added feature', author: 'dev', date: 1705276900 },
        ],
    }

    const mockRepo = {
        name: 'test_repo',
        owner: 'testowner',
        repo_name: 'testrepo',
        branch: 'master',
    }

    it('renders without crashing', () => {
        const wrapper = mount(GitCommitsListDay, {
            props: {
                groupedCommits: mockGroupedCommits,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the date header', () => {
        const wrapper = mount(GitCommitsListDay, {
            props: {
                groupedCommits: mockGroupedCommits,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.CommitsOnDate')
    })

    it('renders GitCommitsListDayCommit for each commit', () => {
        const wrapper = mount(GitCommitsListDay, {
            props: {
                groupedCommits: mockGroupedCommits,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const entries = wrapper.findAllComponents({ name: 'GitCommitsListDayCommit' })
        expect(entries.length).toBe(2)
    })

    it('passes commit data to child components', () => {
        const wrapper = mount(GitCommitsListDay, {
            props: {
                groupedCommits: mockGroupedCommits,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const entries = wrapper.findAllComponents({ name: 'GitCommitsListDayCommit' })
        expect(entries[0].props('commit')).toEqual(mockGroupedCommits.commits[0])
        expect(entries[1].props('commit')).toEqual(mockGroupedCommits.commits[1])
    })

    it('renders timeline item wrapper', () => {
        const wrapper = mount(GitCommitsListDay, {
            props: {
                groupedCommits: mockGroupedCommits,
                repo: mockRepo,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-timeline-item').exists()).toBe(true)
    })
})
