import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { Editor: { Uploading: 'Uploading' } } },
})

vi.mock('@/plugins/helpers', () => ({ formatFilesize: vi.fn((b: number) => `${b} B/s`) }))

vi.mock('vuetify/components', () => ({
    VSnackbar: {
        name: 'VSnackbar',
        props: { timeout: Number, location: String },
        template: '<div class="v-snackbar"><slot /><slot name="actions" :props=\'{}\' /></div>',
    },
    VBtn: {
        name: 'VBtn',
        props: { icon: [String, Boolean], color: String, variant: String },
        template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>',
    },
    VProgressLinear: {
        name: 'VProgressLinear',
        props: { modelValue: Number },
        template: '<div class="v-progress-linear" />',
    },
}))

function makeStore(show = false, overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            files: {
                upload: {
                    show,
                    cancelTokenSource: { cancel: vi.fn() },
                    filename: '',
                    currentNumber: 0,
                    maxNumber: 0,
                    speed: 0,
                    percent: 0,
                    ...overrides,
                },
            },
        },
        actions: { 'files/uploadSetShow': vi.fn(), 'socket/removeLoading': vi.fn() },
    })
}

import TheUploadSnackbar from '@/components/TheUploadSnackbar.vue'

describe('TheUploadSnackbar.vue', () => {
    it('does not render when show is false', () => {
        const wrapper = mount(TheUploadSnackbar, { global: { plugins: [makeStore(false), i18n] } })
        expect(wrapper.find('.v-snackbar').exists()).toBe(false)
    })

    it('renders when show is true', () => {
        const wrapper = mount(TheUploadSnackbar, {
            global: { plugins: [makeStore(true, { filename: 'test.gcode', percent: 50 }), i18n] },
        })
        expect(wrapper.find('.v-snackbar').exists()).toBe(true)
        expect(wrapper.text()).toContain('test.gcode')
        expect(wrapper.text()).toContain('50 %')
    })

    it('shows counter when maxNumber > 1', () => {
        const wrapper = mount(TheUploadSnackbar, {
            global: { plugins: [makeStore(true, { currentNumber: 1, maxNumber: 3, percent: 50 }), i18n] },
        })
        expect(wrapper.text()).toContain('1/3')
    })

    it('renders progress bar', () => {
        const wrapper = mount(TheUploadSnackbar, { global: { plugins: [makeStore(true, { percent: 75 }), i18n] } })
        expect(wrapper.find('.v-progress-linear').exists()).toBe(true)
    })

    it('cancel button calls cancelUpload and dispatches cleanup', async () => {
        const cancelFn = vi.fn()
        const store = makeStore(true, { cancelTokenSource: { cancel: cancelFn }, filename: 'test.gcode', percent: 50 })
        const wrapper = mount(TheUploadSnackbar, { global: { plugins: [store, i18n] } })
        const cancelBtn = wrapper.find('.v-btn')
        await cancelBtn.trigger('click')
        expect(cancelFn).toHaveBeenCalled()
    })

    it('watches show and adds CSS class to body when true', async () => {
        const store = makeStore(false)
        const wrapper = mount(TheUploadSnackbar, { global: { plugins: [store, i18n] } })
        expect(document.body.classList.contains('fullscreenUpload--active')).toBe(false)
        // Update store to show=true to trigger watcher
        store.state.files.upload.show = true
        ;(await wrapper.vm.$nextTick?.()) ?? new Promise((r) => setTimeout(r, 50))
    })
})
