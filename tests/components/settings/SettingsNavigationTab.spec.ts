import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

vi.mock('@/composables/useNavigation', () => ({
    useNavigation: () => ({
        naviPoints: ref([
            { title: 'Dashboard', type: 'route', path: '/', position: 1, visible: true },
            { title: 'Console', type: 'route', path: '/console', position: 2, visible: true },
        ]),
    }),
}))

vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({
        draggableBgStyle: ref({}),
    }),
}))

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
}))

vi.mock('vuedraggable', () => ({
    default: {
        name: 'draggable',
        props: ['modelValue', 'handle', 'ghostClass', 'group', 'itemKey', 'forceFallback'],
        template: '<div><div v-for="item in modelValue" :key="item.title" class="draggable-item"><slot name="item" :element="item" /></div></div>',
    },
}))

vi.mock('@/components/settings/SettingsNavigationTabItem.vue', () => ({
    default: {
        name: 'SettingsNavigationTabItem',
        props: ['naviPoint'],
        template: '<div class="navi-item">{{ naviPoint?.title }}</div>',
    },
}))

const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
        en: {
            Settings: { NavigationTab: { Navigation: 'Navigation' } },
        },
    },
})

function createStoreWithState() {
    return createStore({
        state: { gui: { navigation: { entries: [] } }, instancesDB: 'moonraker' },
    })
}

import SettingsNavigationTab from '@/components/settings/SettingsNavigationTab.vue'

describe('SettingsNavigationTab.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsNavigationTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders navigation header', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsNavigationTab, {
            global: { plugins: [store, i18n] },
        })
        expect(wrapper.text()).toContain('Navigation')
    })

    it('renders navigation items', () => {
        const store = createStoreWithState()
        const wrapper = mount(SettingsNavigationTab, {
            global: { plugins: [store, i18n] },
        })
        const items = wrapper.findAll('.navi-item')
        expect(items.length).toBeGreaterThanOrEqual(2)
        expect(items[0].text()).toBe('Dashboard')
        expect(items[1].text()).toBe('Console')
    })
})
