import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

// Mock vuetify/components - VRow and VCol as simple div wrappers
vi.mock('vuetify/components', () => {
    const VRow = {
        name: 'VRow',
        template: '<div class="v-row"><slot /></div>',
    }
    const VCol = {
        name: 'VCol',
        template: '<div class="v-col"><slot /></div>',
    }
    return { VRow, VCol }
})

// Mock child components
vi.mock('@/components/panels/HistoryStatisticsPanel.vue', () => ({
    default: {
        name: 'HistoryStatisticsPanel',
        template: '<div class="history-statistics-panel" />',
    },
}))

vi.mock('@/components/panels/HistoryListPanel.vue', () => ({
    default: {
        name: 'HistoryListPanel',
        template: '<div class="history-list-panel" />',
    },
}))

// Mock useBase composable
vi.mock('@/composables/useBase', () => ({
    useBase: vi.fn(() => ({
        socketIsConnected: true,
        hostUrl: new URL('http://localhost:8080'),
        apiUrl: 'http://localhost:8080',
    })),
}))

import HistoryPage from '@/pages/History.vue'

describe('History.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(HistoryPage)
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the history-statistics-panel component', () => {
        const wrapper = mount(HistoryPage)
        const statisticsPanel = wrapper.findComponent({ name: 'HistoryStatisticsPanel' })
        expect(statisticsPanel.exists()).toBe(true)
    })

    it('renders the history-list-panel component', () => {
        const wrapper = mount(HistoryPage)
        const listPanel = wrapper.findComponent({ name: 'HistoryListPanel' })
        expect(listPanel.exists()).toBe(true)
    })
})
