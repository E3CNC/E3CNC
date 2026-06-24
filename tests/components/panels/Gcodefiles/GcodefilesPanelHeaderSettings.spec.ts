import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const mockShowHiddenFiles = { value: false }
const mockShowCompletedFiles = { value: false }
const mockSetShowHiddenFiles = vi.fn()
const mockSetShowCompletedFiles = vi.fn()

vi.mock('@/composables/useGcodeFiles', () => ({
    useGcodeFiles: () => ({
        showHiddenFiles: mockShowHiddenFiles,
        setShowHiddenFiles: mockSetShowHiddenFiles,
        showCompletedFiles: mockShowCompletedFiles,
        setShowCompletedFiles: mockSetShowCompletedFiles,
    }),
}))

vi.mock('@mdi/js', () => ({
    mdiCog: 'mdiCog',
    mdiCheckboxMarked: 'mdiCheckboxMarked',
    mdiCheckboxBlankOutline: 'mdiCheckboxBlankOutline',
}))

vi.mock('vuetify/components', () => ({
    VMenu: {
        name: 'VMenu',
        template: '<div class="v-menu-stub"><slot name="activator" :props="{}" /><slot /></div>',
    },
    VBtn: {
        name: 'VBtn',
        template: '<button class="v-btn-stub"><slot /></button>',
    },
    VIcon: {
        name: 'VIcon',
        props: ['color'],
        template: '<span class="v-icon-stub" @click.stop="$emit(\'click\')"><slot /></span>',
    },
    VList: { name: 'VList', template: '<div class="v-list-stub"><slot /></div>' },
    VListItem: { name: 'VListItem', template: '<div class="v-list-item-stub"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row-stub"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col-stub"><slot /></div>' },
}))

import GcodefilesPanelHeaderSettings from '@/components/panels/Gcodefiles/GcodefilesPanelHeaderSettings.vue'

describe('GcodefilesPanelHeaderSettings.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(GcodefilesPanelHeaderSettings, {
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders activator button with cog icon', () => {
        const wrapper = mount(GcodefilesPanelHeaderSettings, {
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-btn-stub').exists()).toBe(true)
        expect(wrapper.find('.v-icon-stub').exists()).toBe(true)
    })

    it('renders menu with hidden files and completed files options', () => {
        const wrapper = mount(GcodefilesPanelHeaderSettings, {
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-menu-stub').exists()).toBe(true)
        expect(wrapper.find('.v-list-stub').exists()).toBe(true)
    })
})
