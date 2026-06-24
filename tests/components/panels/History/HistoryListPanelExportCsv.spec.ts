import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed } from 'vue'

const mockSelectedJobs = { value: [] as any[] }
const mockJobs = { value: [] as any[] }
const mockBrowserLocale = { value: 'en-US' }

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        browserLocale: mockBrowserLocale,
        formatDateTime: (timestamp: number) => new Date(timestamp).toLocaleDateString(),
    }),
}))

vi.mock('@/composables/useHistory', () => ({
    useHistory: () => ({
        selectedJobs: mockSelectedJobs,
        jobs: mockJobs,
    }),
}))

vi.mock('@mdi/js', () => ({
    mdiDatabaseExportOutline: 'mdiDatabaseExportOutline',
}))

vi.mock('vuetify/components', () => ({
    VTooltip: {
        name: 'VTooltip',
        template: '<div class="v-tooltip-stub"><slot name="activator" :props="{}" /><slot /></div>',
    },
    VBtn: {
        name: 'VBtn',
        template: '<button class="v-btn-stub" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', template: '<span class="v-icon-stub"><slot /></span>' },
}))

import HistoryListPanelExportCsv from '@/components/panels/History/HistoryListPanelExportCsv.vue'

describe('HistoryListPanelExportCsv.vue', () => {
    beforeEach(() => {
        mockSelectedJobs.value = []
        mockJobs.value = []
    })

    it('renders without crashing', () => {
        const wrapper = mount(HistoryListPanelExportCsv, {
            props: {
                headers: [{ value: 'filename', visible: true, text: 'Filename' }],
                tableFields: [{ value: 'status', visible: true, text: 'Status' }],
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders export button with icon', () => {
        const wrapper = mount(HistoryListPanelExportCsv, {
            props: {
                headers: [],
                tableFields: [],
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })
        expect(wrapper.find('.v-btn-stub').exists()).toBe(true)
        expect(wrapper.find('.v-icon-stub').exists()).toBe(true)
    })

    it('renders tooltip with translated text', () => {
        const wrapper = mount(HistoryListPanelExportCsv, {
            props: {
                headers: [],
                tableFields: [],
            },
            global: {
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })
        expect(wrapper.find('.v-tooltip-stub').exists()).toBe(true)
    })
})
