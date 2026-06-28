import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GitCommitsList from '@/components/panels/Machine/UpdatePanel/GitCommitsList.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiUpdate: 'mdi-update',
    mdiCloseThick: 'mdi-close-thick',
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'maxWidth', 'fullscreen'],
        template: '<div class="v-dialog" v-if="$props.modelValue"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VTimeline: {
        name: 'VTimeline',
        props: ['alignTop', 'density'],
        template: '<div class="v-timeline"><slot /></div>',
    },
    VTimelineItem: { name: 'VTimelineItem', props: ['size'], template: '<div class="v-timeline-item"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VAlert: { name: 'VAlert', props: ['density', 'variant', 'color'], template: '<div class="v-alert"><slot /></div>' },
    VBtn: { name: 'VBtn', props: ['icon', 'href', 'rounded'], template: '<button class="v-btn"><slot /></button>' },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], cardClass: String, marginBottom: Boolean },
        template:
            '<div class="panel" :class="cardClass"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('@/components/panels/Machine/UpdatePanel/GitCommitsListDay.vue', () => ({
    default: {
        name: 'GitCommitsListDay',
        props: ['repo', 'groupedCommits'],
        template: '<div class="git-commits-list-day-stub">{{ groupedCommits.date }}</div>',
    },
}))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: {
        name: 'OverlayScrollbarsComponent',
        props: ['style', 'options'],
        template: '<div class="overlay-scrollbars"><slot /></div>',
    },
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ isMobile: { value: false } }),
}))

describe('GitCommitsList.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const mockRepo = {
        name: 'test_repo',
        owner: 'testowner',
        repo_name: 'testrepo',
        branch: 'master',
        commits_behind: [
            { sha: 'abc123', subject: 'Fix bug', message: 'Fixed a bug', author: 'dev', date: 1700000000 },
            { sha: 'def456', subject: 'Add feature', message: 'Added feature', author: 'dev', date: 1700000100 },
        ],
    }

    it('does not render dialog when modelValue is false', () => {
        const wrapper = mount(GitCommitsList, {
            props: { modelValue: false, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders dialog when modelValue is true', () => {
        const wrapper = mount(GitCommitsList, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('renders with panel title', () => {
        const wrapper = mount(GitCommitsList, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel-title').text()).toContain('Machine.UpdatePanel.Commits')
    })

    it('renders GitCommitsListDay for each group', () => {
        const wrapper = mount(GitCommitsList, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        const dayComponents = wrapper.findAllComponents({ name: 'GitCommitsListDay' })
        expect(dayComponents.length).toBeGreaterThanOrEqual(1)
    })

    it('renders overlay scrollbars component', () => {
        const wrapper = mount(GitCommitsList, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.overlay-scrollbars').exists()).toBe(true)
    })

    it('renders null repo gracefully', () => {
        const wrapper = mount(GitCommitsList, {
            props: { modelValue: true, repo: null },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('has close button in buttons slot', () => {
        const wrapper = mount(GitCommitsList, {
            props: { modelValue: true, repo: mockRepo },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        // The panel should have at least one button (close button in buttons slot)
        expect(wrapper.find('.v-btn').exists()).toBe(true)
    })

    it('shows full history warning when 30+ commits', () => {
        const manyCommits = Array.from({ length: 30 }, (_, i) => ({
            sha: `sha${i}`,
            subject: `Commit ${i}`,
            message: `Message ${i}`,
            author: 'dev',
            date: 1700000000 + i * 100,
        }))
        const wrapper = mount(GitCommitsList, {
            props: { modelValue: true, repo: { ...mockRepo, commits_behind: manyCommits } },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.MoreCommitsInfo')
    })
})
