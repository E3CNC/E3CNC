import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import TheUpdateDialog from '@/components/TheUpdateDialog.vue'

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            App: {
                UpdateDialog: {
                    Updating: 'Updating {software}',
                    UpdatingDone: '{software} updated',
                    Recovering: 'Recovering {software}',
                    RecoveringDone: '{software} recovered',
                    Empty: 'No messages',
                },
            },
            Buttons: { Close: 'Close' },
        },
    },
})

vi.mock('@/composables/useSocket', () => ({ useSocket: () => ({ emit: vi.fn() }) }))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: {
        name: 'OverlayScrollbarsComponent',
        template: '<div class="overlay-scrollbars"><slot /></div>',
    },
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: { modelValue: Boolean, maxWidth: [String, Number], persistent: Boolean },
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VCard: {
        name: 'VCard',
        props: { loading: Boolean },
        template: '<div class="v-card"><slot name="progress" /><slot /></div>',
    },
    VProgressLinear: {
        name: 'VProgressLinear',
        props: { color: String, indeterminate: Boolean },
        template: '<div class="v-progress-linear" />',
    },
    VToolbar: {
        name: 'VToolbar',
        props: { flat: Boolean, density: String },
        template: '<div class="v-toolbar"><slot /></div>',
    },
    VToolbarTitle: { name: 'VToolbarTitle', template: '<div class="v-toolbar-title"><slot /></div>' },
    VIcon: { name: 'VIcon', props: { start: Boolean, icon: String }, template: '<i class="v-icon"><slot /></i>' },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', props: { cols: [String, Number] }, template: '<div class="v-col"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: { variant: String, color: String, disabled: Boolean },
        template: '<button class="v-btn" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    },
    VSpacer: { name: 'VSpacer', template: '<span class="v-spacer" />' },
    VDataTable: {
        name: 'VDataTable',
        props: {
            headers: Array,
            items: Array,
            itemKey: String,
            hideDefaultFooter: Boolean,
            hideDefaultHeader: Boolean,
            disablePagination: Boolean,
            sortBy: String,
            sortDesc: Boolean,
        },
        template:
            '<div class="v-data-table"><slot v-if="items.length === 0" name="no-data" /><slot v-if="items.length > 0" name="item" :item="{ item: items[0] }" /></div>',
    },
}))

function makeStore(application = '', complete = true, messages: any[] = []) {
    return createStore({
        state: {
            server: {
                updateManager: {
                    updateResponse: { application, complete, messages },
                },
            },
        },
        mutations: {
            'server/updateManager/resetUpdateResponse': vi.fn(),
        },
    })
}

describe('TheUpdateDialog.vue', () => {
    it('does not render when application is empty', () => {
        const wrapper = mount(TheUpdateDialog, { global: { plugins: [makeStore(''), i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders when application is set', () => {
        const wrapper = mount(TheUpdateDialog, { global: { plugins: [makeStore('mainsail'), i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('shows updating message when not complete', () => {
        const wrapper = mount(TheUpdateDialog, { global: { plugins: [makeStore('mainsail', false), i18n] } })
        expect(wrapper.text()).toContain('Updating mainsail')
    })

    it('shows done message when complete', () => {
        const wrapper = mount(TheUpdateDialog, { global: { plugins: [makeStore('mainsail', true), i18n] } })
        expect(wrapper.text()).toContain('mainsail updated')
    })

    it('shows recovering message for recover_ prefix', () => {
        const wrapper = mount(TheUpdateDialog, { global: { plugins: [makeStore('recover_klipper', false), i18n] } })
        expect(wrapper.text()).toContain('Recovering')
        expect(wrapper.text()).toContain('klipper')
    })

    it('shows close button when complete', () => {
        const wrapper = mount(TheUpdateDialog, { global: { plugins: [makeStore('mainsail', true), i18n] } })
        const closeBtn = wrapper.findAll('button').find((b) => b.text().includes('Close'))
        expect(closeBtn).toBeTruthy()
    })

    it('renders no-data slot when messages empty', () => {
        const wrapper = mount(TheUpdateDialog, { global: { plugins: [makeStore('mainsail', true, []), i18n] } })
        expect(wrapper.text()).toContain('No messages')
    })
})
