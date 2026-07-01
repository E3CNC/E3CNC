import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TheServiceWorker from '@/components/TheServiceWorker.vue'

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            App: {
                TheServiceWorker: {
                    TitleNeedUpdate: 'Update Available',
                    DescriptionNeedUpdate: 'A new version is available.',
                    Update: 'Update',
                },
            },
        },
    },
})

vi.mock('virtual:pwa-register', () => ({
    registerSW: vi.fn(() => vi.fn()),
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { title: String, cardClass: String, marginBottom: Boolean },
        template: '<div class="panel"><slot /></div>',
    },
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: { modelValue: Boolean, persistent: Boolean, maxWidth: [String, Number] },
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: { variant: String, color: String },
        template: '<button class="v-btn" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

describe('TheServiceWorker.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('mounts without crashing', () => {
        const wrapper = mount(TheServiceWorker, { global: { plugins: [i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('dialog is hidden by default', () => {
        const wrapper = mount(TheServiceWorker, { global: { plugins: [i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders no buttons when dialog is hidden', () => {
        const wrapper = mount(TheServiceWorker, { global: { plugins: [i18n] } })
        expect(wrapper.findAll('button').length).toBe(0)
    })

    it('calls registerSW on mount with expected options', async () => {
        const { registerSW } = await import('virtual:pwa-register')
        mount(TheServiceWorker, { global: { plugins: [i18n] } })
        await new Promise((r) => setTimeout(r, 20))

        expect(registerSW).toHaveBeenCalled()
        const options = vi.mocked(registerSW).mock.calls[0]?.[0]
        if (options) {
            expect(options.immediate).toBe(true)
            expect(typeof options.onOfflineReady).toBe('function')
            expect(typeof options.onNeedRefresh).toBe('function')
            expect(typeof options.onRegistered).toBe('function')
            expect(typeof options.onRegisterError).toBe('function')
        }
    })
})
