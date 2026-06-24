import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import LogfilesPanelRolloverDialog from '@/components/panels/Machine/LogfilesPanel/LogfilesPanelRolloverDialog.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiCloseThick: 'mdi-close-thick',
    mdiFileSyncOutline: 'mdi-file-sync-outline',
}))

vi.mock('vuetify/components', () => ({
    VDialog: { name: 'VDialog', props: ['modelValue', 'width', 'fullscreen'], template: '<div class="v-dialog" v-if="$props.modelValue"><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VCheckbox: { name: 'VCheckbox', props: ['modelValue', 'label', 'value', 'hideDetails'], template: '<label class="v-checkbox">{{ $props.label }}</label>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<div class="v-spacer" />' },
    VBtn: { name: 'VBtn', props: ['icon', 'variant', 'color', 'rounded'], template: '<button class="v-btn"><slot /></button>' },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], cardClass: String, marginBottom: Boolean },
        template: '<div class="panel" :class="cardClass"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        isMobile: { value: false },
        loadings: { value: [] },
    }),
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: vi.fn(),
    }),
}))

vi.mock('@/plugins/helpers', () => ({
    capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}))

function createMockStore() {
    return createStore({ state: {} })
}

describe('LogfilesPanelRolloverDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not render dialog when modelValue is false', () => {
        const wrapper = mount(LogfilesPanelRolloverDialog, {
            props: { modelValue: false },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders dialog when modelValue is true', () => {
        const wrapper = mount(LogfilesPanelRolloverDialog, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('renders panel with title', () => {
        const wrapper = mount(LogfilesPanelRolloverDialog, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
        expect(wrapper.find('.panel-title').text()).toContain('Machine.LogfilesPanel.Rollover')
    })

    it('renders close button in panel buttons slot', () => {
        const wrapper = mount(LogfilesPanelRolloverDialog, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        // Panel has buttons slot, at least one button rendered
        expect(wrapper.find('.v-btn').exists()).toBe(true)
    })

    it('renders cancel and accept buttons in card-actions', () => {
        const wrapper = mount(LogfilesPanelRolloverDialog, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Buttons.Cancel')
        expect(wrapper.text()).toContain('Machine.LogfilesPanel.Accept')
    })

    it('renders description text', () => {
        const wrapper = mount(LogfilesPanelRolloverDialog, {
            props: { modelValue: true },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.LogfilesPanel.RolloverDescription')
    })
})
