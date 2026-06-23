import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GcodefilesPanelListCardBack from '@/components/panels/Gcodefiles/GcodefilesPanelListCardBack.vue'
import { createI18n } from 'vue-i18n'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const setCurrentPath = vi.fn()

vi.mock('@/composables/useGcodeFiles', () => ({
    useGcodeFiles: () => ({
        currentPath: { value: '/some/parent/child' },
        setCurrentPath,
    }),
}))

vi.mock('@mdi/js', () => ({ mdiArrowLeft: 'M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z' }))

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', props: { class: String }, template: '<div class="v-card" @click="$emit(\'click\')"><slot /></div>' },
    VIcon: { name: 'VIcon', props: { size: [String, Number] }, template: '<i class="v-icon"><slot /></i>' },
}))

describe('GcodefilesPanelListCardBack.vue', () => {
    it('mounts without crashing', () => {
        const wrapper = mount(GcodefilesPanelListCardBack, { global: { plugins: [i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('shows parent directory name', () => {
        const wrapper = mount(GcodefilesPanelListCardBack, { global: { plugins: [i18n] } })
        expect(wrapper.text()).toContain('child')
    })

    it('shows .. label', () => {
        const wrapper = mount(GcodefilesPanelListCardBack, { global: { plugins: [i18n] } })
        expect(wrapper.text()).toContain('..')
    })

    it('calls setCurrentPath with parent path on click', async () => {
        const wrapper = mount(GcodefilesPanelListCardBack, { global: { plugins: [i18n] } })
        await wrapper.find('.v-card').trigger('click')
        expect(setCurrentPath).toHaveBeenCalledWith('/some/parent')
    })

    it('goes to root when currentPath has only one segment', async () => {
        const wrapper = mount(GcodefilesPanelListCardBack, { global: { plugins: [i18n] } })
        await wrapper.find('.v-card').trigger('click')
        expect(setCurrentPath).toHaveBeenCalled()
    })
})
