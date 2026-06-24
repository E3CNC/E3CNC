import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import LogfilesPanelGenericLog from '@/components/panels/Machine/LogfilesPanel/LogfilesPanelGenericLog.vue'

vi.mock('@mdi/js', () => ({
    mdiDownload: 'mdi-download',
}))

vi.mock('vuetify/components', () => ({
    VCol: { name: 'VCol', props: ['cols'], template: '<div class="v-col" :class="\'v-col-\' + $props.cols"><slot /></div>' },
    VBtn: { name: 'VBtn', props: ['href', 'variant'], template: '<a class="v-btn" :href="$props.href"><slot /></a>' },
    VIcon: { name: 'VIcon', template: '<i class="v-icon"><slot /></i>' },
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ apiUrl: { value: 'http://localhost:8080' } }),
}))

// The component sets href via computed, and then uses event handler to open window
// Mock window.open
const mockOpen = vi.fn()
Object.defineProperty(window, 'open', {
    value: mockOpen,
    writable: true,
})

function createMockStore(directoryChildren: any[] = []) {
    return createStore({
        state: {},
        getters: {
            'files/getDirectory': () => () => ({
                childrens: directoryChildren,
            }),
        },
    })
}

describe('LogfilesPanelGenericLog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing for known log (klippy)', () => {
        const wrapper = mount(LogfilesPanelGenericLog, {
            props: { name: 'klippy' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders without crashing for moonraker', () => {
        const wrapper = mount(LogfilesPanelGenericLog, {
            props: { name: 'moonraker' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders button with log name', () => {
        const wrapper = mount(LogfilesPanelGenericLog, {
            props: { name: 'klippy' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('klippy')
    })

    it('renders button with download icon', () => {
        const wrapper = mount(LogfilesPanelGenericLog, {
            props: { name: 'klippy' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-icon').exists()).toBe(true)
    })

    it('renders when log file exists in store', () => {
        const wrapper = mount(LogfilesPanelGenericLog, {
            props: { name: 'other' },
            global: {
                plugins: [createMockStore([{ filename: 'other.log' }])],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-btn').exists()).toBe(true)
    })

    it('does not render when log file does not exist and not known', () => {
        const wrapper = mount(LogfilesPanelGenericLog, {
            props: { name: 'unknown' },
            global: {
                plugins: [createMockStore([])],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-btn').exists()).toBe(false)
    })

    it('has correct href for klippy/moonraker logs', () => {
        const wrapper = mount(LogfilesPanelGenericLog, {
            props: { name: 'klippy' },
            global: {
                plugins: [createMockStore()],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        expect(btn.attributes('href')).toBe('http://localhost:8080/server/files/klippy.log')
    })

    it('has correct href for other logs', () => {
        const wrapper = mount(LogfilesPanelGenericLog, {
            props: { name: 'some_log' },
            global: {
                plugins: [createMockStore([{ filename: 'some_log.log' }])],
                mocks: { $t: (key: string) => key },
            },
        })
        const btn = wrapper.find('.v-btn')
        expect(btn.attributes('href')).toBe('http://localhost:8080/server/files/logs/some_log.log')
    })
})
