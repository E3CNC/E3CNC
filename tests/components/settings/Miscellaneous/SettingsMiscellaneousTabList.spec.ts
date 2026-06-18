import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useMiscellaneous', () => ({
    useMiscellaneous: () => ({
        lights: ref([{ type: 'neopixel', name: 'case' }]),
    }),
}))

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
}))

vi.mock('@/components/settings/Miscellaneous/SettingsMiscellaneousTabListLight.vue', () => ({
    default: {
        name: 'SettingsMiscellaneousTabListLight',
        props: ['type', 'name'],
        template: '<div class="light-entry">{{ type }}: {{ name }}</div>',
    },
}))

const i18n = createI18n({
    legacy: false, locale: 'en',
    messages: {
        en: {
            Settings: { MiscellaneousTab: { Miscellaneous: 'Miscellaneous', NoDevicesFound: 'No devices found' } },
        },
    },
})

function createStoreWithState() {
    return createStore({
        state: {
            printer: { configfile: { settings: { 'neopixel case': { color_order: 'RGB' } } } },
        },
    })
}

import SettingsMiscellaneousTabList from '@/components/settings/Miscellaneous/SettingsMiscellaneousTabList.vue'

describe('SettingsMiscellaneousTabList.vue', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMiscellaneousTabList, { global: { plugins: [store, i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders miscellaneous header', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMiscellaneousTabList, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Miscellaneous')
    })

    it('renders light entries', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsMiscellaneousTabList, { global: { plugins: [store, i18n] } })
        expect(wrapper.findAll('.light-entry').length).toBe(1)
        expect(wrapper.text()).toContain('neopixel')
        expect(wrapper.text()).toContain('case')
    })


})
