import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import TheTimelapseRenderingSnackbar from '@/components/TheTimelapseRenderingSnackbar.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { Timelapse: { TimelapseRendering: 'Rendering', TimelapseRenderingSuccessful: 'Done' } } } })

vi.mock('vuetify/components', () => ({
    VSnackbar: { name: 'VSnackbar', props: { modelValue: Boolean, timeout: Number, location: String }, template: '<div class="v-snackbar" v-if="modelValue"><slot /></div>' },
    VProgressLinear: { name: 'VProgressLinear', props: { modelValue: Number, indeterminate: Boolean }, template: '<div class="v-progress-linear" />' },
}))

function makeStore(status: string = '', progress: number = 0, filename: string = '') {
    return createStore({
        state: {
            server: {
                timelapse: {
                    rendering: { status, progress, filename },
                },
                klippy_connected: true,
                klippy_state: 'ready',
            },
        },
        actions: { 'server/timelapse/resetSnackbar': vi.fn() },
    })
}

describe('TheTimelapseRenderingSnackbar.vue', () => {
    it('mounts without crashing', () => {
        const wrapper = mount(TheTimelapseRenderingSnackbar, { global: { plugins: [makeStore(), i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('shows running snackbar when status is running', () => {
        const wrapper = mount(TheTimelapseRenderingSnackbar, { global: { plugins: [makeStore('running'), i18n] } })
        const snackbars = wrapper.findAll('.v-snackbar')
        expect(snackbars.length).toBe(1)
        expect(wrapper.text()).toContain('Rendering')
    })

    it('shows success snackbar when status is success', () => {
        const wrapper = mount(TheTimelapseRenderingSnackbar, { global: { plugins: [makeStore('success', 100, 'output.mp4'), i18n] } })
        const snackbars = wrapper.findAll('.v-snackbar')
        expect(snackbars.length).toBe(1)
        expect(wrapper.text()).toContain('Done')
        expect(wrapper.text()).toContain('output.mp4')
    })

    it('shows no snackbar when status is empty', () => {
        const wrapper = mount(TheTimelapseRenderingSnackbar, { global: { plugins: [makeStore(''), i18n] } })
        expect(wrapper.findAll('.v-snackbar').length).toBe(0)
    })

    it('shows running snackbar with progress bar', () => {
        const wrapper = mount(TheTimelapseRenderingSnackbar, { global: { plugins: [makeStore('running', 50), i18n] } })
        expect(wrapper.find('.v-progress-linear').exists()).toBe(true)
    })
})
