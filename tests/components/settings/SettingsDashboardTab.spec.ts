import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('vue-router', () => ({
    useRoute: () => ({ query: {}, path: '/settings', hash: '' }),
    useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        isMobile: ref(false),
        isTablet: ref(false),
        isDesktop: ref(true),
        isWidescreen: ref(false),
    }),
}))

vi.mock('vuetify/components', () => ({
    VCard: { name: 'VCard', inheritAttrs: false, template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        template: '<button :class="\'v-btn\'" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VBtnToggle: {
        name: 'VBtnToggle',
        props: ['modelValue', 'mandatory'],
        template: '<div class="v-btn-toggle"><slot /></div>',
    },
    VIcon: { name: 'VIcon', template: '<i><slot /></i>' },
}))

vi.mock('@/components/settings/Dashboard/Mobile.vue', () => ({
    default: { name: 'SettingsDashboardTabMobile', template: '<div class="dashboard-mobile">Mobile</div>' },
}))

vi.mock('@/components/settings/Dashboard/Tablet.vue', () => ({
    default: { name: 'SettingsDashboardTabTablet', template: '<div class="dashboard-tablet">Tablet</div>' },
}))

vi.mock('@/components/settings/Dashboard/Desktop.vue', () => ({
    default: { name: 'SettingsDashboardTabDesktop', template: '<div class="dashboard-desktop">Desktop</div>' },
}))

vi.mock('@/components/settings/Dashboard/Widescreen.vue', () => ({
    default: { name: 'SettingsDashboardTabWidescreen', template: '<div class="dashboard-widescreen">Widescreen</div>' },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: {
                DashboardTab: {
                    Mobile: 'Mobile',
                    Tablet: 'Tablet',
                    Desktop: 'Desktop',
                    Widescreen: 'Widescreen',
                    ResetLayout: 'Reset Layout',
                },
            },
        },
    },
})

function createStoreWithState() {
    return createStore({
        state: { gui: { dashboard: {} }, instancesDB: 'moonraker' },
    })
}

import SettingsDashboardTab from '@/components/settings/SettingsDashboardTab.vue'

describe('SettingsDashboardTab.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsDashboardTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders viewport toggle buttons', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsDashboardTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Mobile')
        expect(wrapper.text()).toContain('Tablet')
        expect(wrapper.text()).toContain('Desktop')
        expect(wrapper.text()).toContain('Widescreen')
    })

    it('renders reset layout button', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsDashboardTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Reset Layout')
    })

    it('renders desktop component by default', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsDashboardTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.find('.dashboard-desktop').exists()).toBe(true)
    })

    it('emits resetLayout event', async () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsDashboardTab, {
            global: { plugins: [store, i18n] },
        })
        const resetBtn = wrapper.findAll('button').filter((b) => b.text() === 'Reset Layout')
        await resetBtn[0].trigger('click')
        expect(wrapper.emitted('resetLayout')).toBeTruthy()
    })
})
