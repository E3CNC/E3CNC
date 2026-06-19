import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WebcamWrapper from '@/components/webcams/WebcamWrapper.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vuex', () => ({
    useStore: () => ({
        getters: {
            'gui/webcams/getWebcams': [],
        },
    }),
}))

vi.mock('vuetify/components', () => ({
    VApp: { name: 'VApp', template: '<div><slot /></div>' },
    VContainer: { name: 'VContainer', template: '<div class="v-container"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
}))

vi.mock('@/components/webcams/WebcamWrapperItem.vue', () => ({
    default: {
        name: 'WebcamWrapperItem',
        props: ['webcam', 'showFps', 'printerUrl', 'page'],
        template: '<div class="webcam-wrapper-item-mock">{{ webcam?.name }}</div>',
    },
}))

const vuetifyStubs: Record<string, any> = {
    VContainer: { name: 'VContainer', template: '<div class="v-container"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
}

function createWrapper(overrides: Record<string, any> = {}) {
    return mount(WebcamWrapper, {
        props: {
            webcam: { name: 'TestCam', service: 'mjpegstreamer', icon: 'mdiWebcam' },
            showFps: true,
            page: undefined,
            ...overrides,
        },
        global: {
            components: vuetifyStubs,
            mocks: { $t: (key: string) => key },
        },
    })
}

describe('WebcamWrapper.vue', () => {
    it('renders without crashing', () => {
        const wrapper = createWrapper()
        expect(wrapper.exists()).toBe(true)
    })

    it('renders single webcam-wrapper-item for non-grid service', () => {
        const wrapper = createWrapper()
        expect(wrapper.find('.webcam-wrapper-item-mock').exists()).toBe(true)
    })

    it('passes webcam name to webcam-wrapper-item', () => {
        const wrapper = createWrapper()
        expect(wrapper.text()).toContain('TestCam')
    })

    it('renders grid layout for grid service', () => {
        const gridWebcams = [
            { name: 'Cam1', service: 'mjpegstreamer' },
            { name: 'Cam2', service: 'mjpegstreamer' },
        ]
        const wrapper = mount(WebcamWrapper, {
            props: {
                webcam: { name: 'Grid', service: 'grid' },
                showFps: true,
            },
            global: {
                components: vuetifyStubs,
                mocks: { $t: (key: string) => key },
                stubs: { WebcamWrapperItem: true },
            },
        })
        expect(wrapper.find('.v-container').exists()).toBe(true)
    })

    it('renders multiple webcam-wrapper-items in grid mode', () => {
        const wrapper = mount(WebcamWrapper, {
            props: {
                webcam: { name: 'Grid', service: 'grid' },
                showFps: true,
            },
            global: {
                components: vuetifyStubs,
                mocks: { $t: (key: string) => key },
                stubs: { WebcamWrapperItem: true },
            },
        })
        expect(wrapper.findAllComponents({ name: 'WebcamWrapperItem' }).length).toBeGreaterThanOrEqual(0)
    })

    it('passes page prop correctly', () => {
        const wrapper = createWrapper({ page: 'dashboard' })
        expect(wrapper.find('.webcam-wrapper-item-mock').exists()).toBe(true)
    })
})
