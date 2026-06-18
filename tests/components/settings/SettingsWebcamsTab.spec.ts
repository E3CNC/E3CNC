import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({}),
}))

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: ['size', 'variant', 'color', 'disabled'],
        template: '<button @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

vi.mock('@/components/settings/Webcams/WebcamListEntry.vue', () => ({
    default: {
        name: 'WebcamListEntry',
        props: ['webcam', 'boolBorderTop'],
        template: '<div class="webcam-entry">{{ webcam?.name }}</div>',
    },
}))

vi.mock('@/components/settings/Webcams/WebcamForm.vue', () => ({
    default: {
        name: 'WebcamForm',
        props: ['webcam', 'type'],
        template: '<div class="webcam-form">Form</div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                WebcamsTab: {
                    Webcams: 'Webcams',
                    AddWebcam: 'Add Webcam',
                    EditCrowsnestConf: 'Edit Crowsnest Config',
                },
            },
        },
    },
})

function createStoreWithState() {
    return createStore({
        state: {
            files: {},
            gui: { webcams: { webcams: [] } },
            instancesDB: 'moonraker',
        },
        getters: {
            'files/getDirectory': () => () => ({ childrens: [] }),
        },
    })
}

import SettingsWebcamsTab from '@/components/settings/SettingsWebcamsTab.vue'

describe('SettingsWebcamsTab.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsWebcamsTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders webcams header', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsWebcamsTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Webcams')
    })

    it('renders add webcam button', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsWebcamsTab, { global: { plugins: [store, i18n] } })
        expect(wrapper.text()).toContain('Add Webcam')
    })

    it('shows webcam form when add webcam is clicked', async () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsWebcamsTab, { global: { plugins: [store, i18n] } })
        const addBtn = wrapper.findAll('button').filter((b) => b.text() === 'Add Webcam')
        await addBtn[0].trigger('click')
        expect(wrapper.find('.webcam-form').exists()).toBe(true)
    })
})
